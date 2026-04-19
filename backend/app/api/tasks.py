import asyncio
import logging
import uuid
from urllib.parse import quote

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models.processed_file import ProcessedFile
from app.models.task import Task, TaskStatus
from app.models.user import User
from app.schemas.task import BatchStatusOut, TaskHistoryItem, TaskHistoryOut, TaskResultOut, TaskStatusOut
from app.services.storage_service import StorageError, get_signed_url, storage_healthcheck

router = APIRouter(prefix="/tasks", tags=["tasks"])

logger = logging.getLogger("imagify.tasks")

DOWNLOAD_TIMEOUT_SECONDS = 90.0
DOWNLOAD_RETRIES = 1  # one retry on transient failure
SIGNED_URL_TTL_SECONDS = 3600


def download_url_for(task_id: uuid.UUID) -> str:
    """Backend proxy URL — used as a fallback when signing fails.

    The proxy is a last resort because PaaS edge layers (Render, Cloudflare,
    etc.) can interfere with streamed binary bodies (gzip handling, buffering,
    Content-Length games). Prefer ``result_download_url`` which returns a
    direct signed ImageKit URL.
    """
    return f"/tasks/{task_id}/download"


def result_download_url(pf: ProcessedFile, task_id: uuid.UUID) -> str:
    """Build the URL the client should hit to download a processed file.

    Returns a fresh signed ImageKit URL when possible (client downloads
    directly from the CDN — fast, byte-perfect, supports range requests).
    Falls back to the backend proxy only if signing fails.
    """
    if pf.imagekit_file_path:
        try:
            return get_signed_url(pf.imagekit_file_path, expire_seconds=SIGNED_URL_TTL_SECONDS)
        except StorageError as exc:
            logger.warning("Sign URL failed for task %s, using proxy: %s", task_id, exc)
    return download_url_for(task_id)


async def _get_user_task(db: AsyncSession, task_id: uuid.UUID, user_id: uuid.UUID) -> Task:
    task = (
        await db.execute(select(Task).where(Task.id == task_id, Task.user_id == user_id))
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.get("/storage-usage")
async def storage_usage(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Total bytes the current user has stored across all of their processed
    files, plus a count of those files. Cheap aggregate — runs in one query.
    """
    row = (
        await db.execute(
            select(
                func.coalesce(func.sum(ProcessedFile.size_bytes), 0),
                func.count(ProcessedFile.id),
            )
            .join(Task, Task.id == ProcessedFile.task_id)
            .where(Task.user_id == user.id)
        )
    ).one()
    total_bytes, file_count = int(row[0] or 0), int(row[1] or 0)
    return {"total_bytes": total_bytes, "file_count": file_count}


@router.get("/history", response_model=TaskHistoryOut)
async def task_history(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskHistoryOut:
    total = (
        await db.execute(select(func.count()).select_from(Task).where(Task.user_id == user.id))
    ).scalar_one()

    offset = (page - 1) * page_size
    rows = (
        await db.execute(
            select(Task)
            .where(Task.user_id == user.id)
            .order_by(Task.created_at.desc())
            .offset(offset)
            .limit(page_size)
        )
    ).scalars().all()

    return TaskHistoryOut(
        items=[TaskHistoryItem.model_validate(t) for t in rows],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/{task_id}/status", response_model=TaskStatusOut)
async def task_status(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskStatusOut:
    task = await _get_user_task(db, task_id, user.id)
    return TaskStatusOut.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a task and its associated stored file.

    Best-effort: if the storage delete fails (network blip, ImageKit
    transient), we still remove the local rows so the user's history is
    consistent with what they see in the UI. The orphaned ImageKit file
    will be picked up by the daily cleanup job.
    """
    task = (
        await db.execute(
            select(Task)
            .options(selectinload(Task.processed_file))
            .where(Task.id == task_id, Task.user_id == user.id)
        )
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    pf = task.processed_file
    if pf and pf.imagekit_file_id:
        try:
            from app.services.storage_service import delete_file
            delete_file(pf.imagekit_file_id)
        except Exception as exc:
            logger.warning("Storage delete failed during task delete: %s", exc)

    await db.delete(task)
    await db.commit()
    return None


@router.get("/{task_id}/result", response_model=TaskResultOut)
async def task_result(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResultOut:
    """Return a fresh signed ImageKit URL the client can hit directly.

    Hitting ImageKit's CDN directly avoids any chance of our proxy mangling
    binary file bytes (gzip/Content-Length issues, edge-proxy buffering on
    PaaS layers, etc). If signing fails for any reason we fall back to the
    backend proxy at /tasks/{id}/download.
    """
    task = (
        await db.execute(
            select(Task)
            .options(selectinload(Task.processed_file))
            .where(Task.id == task_id, Task.user_id == user.id)
        )
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status != TaskStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Task is not ready (status={task.status.value})",
        )
    pf: ProcessedFile | None = task.processed_file
    if pf is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result file not found")

    return TaskResultOut(
        task_id=task.id,
        download_url=result_download_url(pf, task.id),
        expires_in_seconds=SIGNED_URL_TTL_SECONDS,
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
    )


@router.get("/batch/{batch_id}/status", response_model=BatchStatusOut)
async def batch_status(
    batch_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tasks = (
        await db.execute(
            select(Task)
            .options(selectinload(Task.processed_file))
            .where(Task.batch_id == batch_id, Task.user_id == user.id)
        )
    ).scalars().all()

    if not tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch not found")

    total = len(tasks)
    completed = sum(1 for t in tasks if t.status == TaskStatus.SUCCESS)
    failed = sum(1 for t in tasks if t.status == TaskStatus.FAILED)
    pending = total - completed - failed

    results = []
    for t in tasks:
        if t.status == TaskStatus.SUCCESS and t.processed_file:
            pf = t.processed_file
            results.append(TaskResultOut(
                task_id=t.id,
                download_url=result_download_url(pf, t.id),
                expires_in_seconds=SIGNED_URL_TTL_SECONDS,
                original_filename=pf.original_filename,
                mime_type=pf.mime_type,
                size_bytes=pf.size_bytes,
            ))

    return BatchStatusOut(
        batch_id=batch_id,
        total=total,
        completed=completed,
        failed=failed,
        pending=pending,
        results=results,
        tasks=[TaskStatusOut.model_validate(t) for t in tasks]
    )


# ---- Download proxy ---------------------------------------------------------


def _content_disposition(filename: str) -> str:
    """Build an RFC 5987-safe Content-Disposition header value."""
    safe_ascii = filename.encode("ascii", "ignore").decode("ascii").strip() or "file"
    encoded = quote(filename, safe="")
    return f"attachment; filename=\"{safe_ascii}\"; filename*=UTF-8''{encoded}"


async def _open_upstream(url: str) -> tuple[httpx.AsyncClient, httpx.Response]:
    """Open a streaming GET against ``url``, with one retry on transient failures.

    Returns the live (client, response). Caller is responsible for closing both.

    We send ``Accept-Encoding: identity`` so the CDN does not gzip the body.
    Without this, ``aiter_bytes`` would decode the body but upstream's
    ``Content-Length`` would still be the compressed value — forwarding that
    header to the client truncates the download and corrupts binary files.
    """
    upstream_headers = {
        "User-Agent": "Imagify/1.0",
        "Accept-Encoding": "identity",
    }
    last_exc: Exception | None = None
    for attempt in range(DOWNLOAD_RETRIES + 1):
        client = httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True)
        try:
            response = await client.send(
                client.build_request("GET", url, headers=upstream_headers),
                stream=True,
            )
        except (httpx.HTTPError, httpx.NetworkError) as exc:
            last_exc = exc
            await client.aclose()
            logger.warning("Upstream fetch attempt %d failed: %s", attempt + 1, exc)
            if attempt < DOWNLOAD_RETRIES:
                await asyncio.sleep(0.4 * (attempt + 1))
                continue
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Could not reach storage. Please try again.",
            ) from exc

        # Retry on transient upstream statuses
        if response.status_code in (502, 503, 504) and attempt < DOWNLOAD_RETRIES:
            logger.warning("Upstream returned %s on attempt %d, retrying", response.status_code, attempt + 1)
            await response.aclose()
            await client.aclose()
            await asyncio.sleep(0.4 * (attempt + 1))
            continue

        if response.status_code >= 400:
            # Read a small snippet for diagnostics, then raise
            try:
                snippet = (await response.aread())[:300].decode("utf-8", "replace")
            except Exception:
                snippet = "<unreadable>"
            await response.aclose()
            await client.aclose()
            logger.error(
                "Storage returned %s for %s — %s", response.status_code, url, snippet
            )
            if response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Result file no longer available",
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Storage error ({response.status_code})",
            )

        return client, response

    # Should not reach here, but keep mypy happy
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Storage unreachable",
    ) from last_exc


@router.get("/{task_id}/download")
async def download_task_result(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stream a task's result file from ImageKit through the backend.

    Always generates a fresh signed URL from the stored file_path so we don't
    depend on the upload-time URL working forever (or at all, if the account
    requires signed URLs).
    """
    task = (
        await db.execute(
            select(Task)
            .options(selectinload(Task.processed_file))
            .where(Task.id == task_id, Task.user_id == user.id)
        )
    ).scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task.status != TaskStatus.SUCCESS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Task is not ready (status={task.status.value})",
        )
    pf: ProcessedFile | None = task.processed_file
    if pf is None or not pf.imagekit_file_path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result file not found")

    # Always generate a fresh signed URL from the stored path. This works
    # whether the ImageKit account restricts unsigned URLs or not.
    try:
        signed_url = get_signed_url(pf.imagekit_file_path, expire_seconds=SIGNED_URL_TTL_SECONDS)
    except StorageError as exc:
        logger.error("Failed to sign download URL for task %s: %s", task_id, exc)
        # Fallback: try the stored URL if we have one
        if pf.imagekit_url:
            signed_url = pf.imagekit_url
        else:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not generate download URL") from exc

    client, upstream = await _open_upstream(signed_url)

    async def stream_body():
        try:
            # Use aiter_raw to avoid httpx auto-decoding any encoded body.
            # We requested Accept-Encoding: identity so upstream should send
            # the file as-is, and aiter_raw guarantees we forward those exact
            # bytes to the client.
            async for chunk in upstream.aiter_raw(chunk_size=64 * 1024):
                yield chunk
        finally:
            await upstream.aclose()
            await client.aclose()

    # Prefer the upstream Content-Type (in case ImageKit normalises it),
    # but fall back to what we recorded at upload time.
    content_type = upstream.headers.get("content-type") or pf.mime_type or "application/octet-stream"

    headers = {
        "Content-Disposition": _content_disposition(pf.original_filename or "file"),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }

    # Forward upstream encoding/length together so the client receives a
    # self-consistent response. We're using aiter_raw so the bytes we send
    # are exactly what upstream sent (encoded or identity). If upstream
    # honoured our Accept-Encoding: identity, encoding will be empty/identity
    # and Content-Length is the plain file size. If it didn't, encoding will
    # be e.g. "gzip" and Content-Length is the compressed size — both still
    # consistent with the bytes we forward.
    upstream_encoding = (upstream.headers.get("content-encoding") or "").strip()
    if upstream_encoding and upstream_encoding.lower() != "identity":
        headers["Content-Encoding"] = upstream_encoding
    upstream_length = upstream.headers.get("content-length")
    if upstream_length and upstream_length.isdigit():
        headers["Content-Length"] = upstream_length

    return StreamingResponse(stream_body(), media_type=content_type, headers=headers)


@router.get("/storage/health", tags=["health"])
async def storage_health() -> dict[str, str]:
    """Quick check that ImageKit credentials + SDK are usable."""
    ok, detail = storage_healthcheck()
    return {"status": "ok" if ok else "fail", "detail": detail}
