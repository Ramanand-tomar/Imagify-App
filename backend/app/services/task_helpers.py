"""Shared helpers that bridge a pure service function with the Task/ProcessedFile
DB rows and ImageKit upload. Async variant for FastAPI handlers (sync PDF ops),
sync variant for Celery workers (async PDF ops).
"""
from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.services import storage_service
from app.services.storage_service import StorageError
from app.models.processed_file import ProcessedFile
from app.models.task import Task, TaskStatus, TaskType

logger = logging.getLogger("imagify.task_helpers")

SHARED_TMP = Path("/tmp/imagify")
MAX_FILE_BYTES = 50 * 1024 * 1024
# Read uploads in 1 MiB blocks so peak memory per file never exceeds this.
UPLOAD_CHUNK_BYTES = 1024 * 1024


def ensure_tmp() -> Path:
    SHARED_TMP.mkdir(parents=True, exist_ok=True)
    return SHARED_TMP


async def read_upload(file: UploadFile, *, allowed_mime: set[str] | None = None) -> tuple[bytes, str, str]:
    """Read an UploadFile; enforce size + optional mime whitelist. Returns (data, filename, mime).

    Reads in chunks so a 50 MiB upload never lands in memory as a single
    contiguous read. Aborts mid-stream as soon as ``MAX_FILE_BYTES`` is
    exceeded so an attacker can't OOM us by claiming a small Content-Length
    and sending more.
    """
    mime = file.content_type or "application/octet-stream"
    if allowed_mime and mime not in allowed_mime:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {mime}",
        )

    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = await file.read(UPLOAD_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds {MAX_FILE_BYTES // 1024 // 1024}MB limit",
            )
        chunks.append(chunk)
    data = b"".join(chunks)
    return data, file.filename or "upload.bin", mime


async def spool_upload_to_disk(
    file: UploadFile,
    *,
    allowed_mime: set[str] | None = None,
) -> tuple[Path, str, str, int]:
    """Stream an UploadFile into a temp file. Returns (path, filename, mime, size).

    Use this when handling many uploads in one request so the request
    handler never has to hold all file bodies in memory at once. The
    returned path is in ``SHARED_TMP`` and has a uuid-prefixed name; the
    caller is responsible for ``Path(path).unlink(missing_ok=True)`` once
    done.
    """
    mime = file.content_type or "application/octet-stream"
    if allowed_mime and mime not in allowed_mime:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {mime}",
        )

    ensure_tmp()
    safe_name = Path(file.filename or "upload.bin").name
    target = SHARED_TMP / f"{uuid.uuid4().hex}_{safe_name}"
    total = 0
    try:
        # Open in binary mode and write the upload in chunks so peak memory
        # is bounded regardless of file size.
        with target.open("wb") as fh:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_FILE_BYTES:
                    fh.close()
                    target.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds {MAX_FILE_BYTES // 1024 // 1024}MB limit",
                    )
                fh.write(chunk)
    except HTTPException:
        raise
    except Exception:
        target.unlink(missing_ok=True)
        raise
    return target, file.filename or "upload.bin", mime, total


def stash_bytes(data: bytes, filename: str) -> Path:
    """Save to shared tmp so a worker can read it. Returns absolute path."""
    ensure_tmp()
    unique = f"{uuid.uuid4().hex}_{Path(filename).name}"
    path = SHARED_TMP / unique
    path.write_bytes(data)
    return path


def load_stashed(path: str | os.PathLike[str]) -> bytes:
    return Path(path).read_bytes()


def remove_stashed(path: str | os.PathLike[str]) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except Exception:
        pass


def remove_stashed_unless_retrying(
    path: str | os.PathLike[str],
    *,
    retries: int,
    max_retries: int,
    succeeded: bool,
) -> None:
    """Remove a stashed source file only when it is safe to do so.

    Called from a Celery task's ``finally`` block — when the task is going to
    be retried, the source bytes must remain on disk for the next attempt.
    """
    final_attempt = retries >= max_retries
    if succeeded or final_attempt:
        remove_stashed(path)


def cleanup_stale_stash(max_age_seconds: int = 6 * 60 * 60) -> int:
    """Best-effort sweeper for orphaned stash files (e.g. crashed worker)."""
    import time
    now = time.time()
    removed = 0
    if not SHARED_TMP.exists():
        return 0
    for p in SHARED_TMP.iterdir():
        try:
            if p.is_file() and (now - p.stat().st_mtime) > max_age_seconds:
                p.unlink(missing_ok=True)
                removed += 1
        except Exception:
            continue
    return removed


# ---- sync-path helpers (used by FastAPI handlers) ---------------------------


async def record_sync_result(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    task_type: TaskType,
    result_bytes: bytes,
    filename: str,
    mime_type: str,
) -> tuple[Task, ProcessedFile]:
    """For sync ops: upload to ImageKit + persist Task + ProcessedFile in one go.

    On storage failure, raises HTTPException(502) so the client gets a clear
    "couldn't reach storage" message rather than a generic 500.
    """
    task = Task(user_id=user_id, task_type=task_type, status=TaskStatus.SUCCESS, progress=100)
    db.add(task)
    await db.flush()

    try:
        file_id, file_path, url = storage_service.upload_file(
            result_bytes, filename, task_id=str(task.id)
        )
    except StorageError as exc:
        # Mark the task as failed so the client sees the right state on retry
        task.status = TaskStatus.FAILED
        task.error_message = str(exc)[:1000]
        await db.commit()
        logger.error("Storage upload failed for task %s: %s", task.id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Couldn't save the result to storage. Please try again.",
        ) from exc

    pf = ProcessedFile(
        task_id=task.id,
        imagekit_file_id=file_id,
        imagekit_url=url,
        imagekit_file_path=file_path,
        original_filename=filename,
        mime_type=mime_type,
        size_bytes=len(result_bytes),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(pf)
    await db.commit()
    await db.refresh(task)
    await db.refresh(pf)
    return task, pf


# ---- async-path helpers (used by Celery workers via sync Session) -----------


def create_pending_task_sync(
    db: Session, *, user_id: uuid.UUID, task_type: TaskType, batch_id: uuid.UUID | None = None
) -> Task:
    task = Task(user_id=user_id, task_type=task_type, status=TaskStatus.PENDING, progress=0, batch_id=batch_id)
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


async def create_pending_task_async(
    db: AsyncSession, *, user_id: uuid.UUID, task_type: TaskType, batch_id: uuid.UUID | None = None
) -> Task:
    task = Task(user_id=user_id, task_type=task_type, status=TaskStatus.PENDING, progress=0, batch_id=batch_id)
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


def finalize_task_sync(
    db: Session,
    task: Task,
    result_bytes: bytes,
    filename: str,
    mime_type: str,
) -> ProcessedFile:
    """Worker-side finalize. Re-raises StorageError on upload failure so the
    Celery task's retry policy can catch it. The caller is responsible for
    persisting FAILED state only when no retries remain (use
    ``record_task_attempt_failure_sync`` in the task's ``except`` block).
    """
    try:
        file_id, file_path, url = storage_service.upload_file(
            result_bytes, filename, task_id=str(task.id)
        )
    except StorageError as exc:
        logger.error("Worker storage upload failed for task %s: %s", task.id, exc)
        # Don't mark FAILED here — let the Celery task decide based on its
        # remaining retry budget. Just stash the latest error so it shows
        # up in the polling response.
        task.error_message = f"Storage upload failed: {exc}"[:1000]
        db.commit()
        raise

    pf = ProcessedFile(
        task_id=task.id,
        imagekit_file_id=file_id,
        imagekit_url=url,
        imagekit_file_path=file_path,
        original_filename=filename,
        mime_type=mime_type,
        size_bytes=len(result_bytes),
        expires_at=datetime.now(timezone.utc) + timedelta(days=7)
    )
    db.add(pf)
    task.status = TaskStatus.SUCCESS
    task.progress = 100
    db.commit()
    db.refresh(pf)
    return pf


def mark_task_failed_sync(db: Session, task: Task, error: str) -> None:
    """Force-mark a task FAILED with an error message. Use only when there
    will be no further retry — see ``record_task_attempt_failure_sync``
    for the retry-aware variant."""
    task.status = TaskStatus.FAILED
    task.error_message = error[:1000]
    db.commit()


def record_task_attempt_failure_sync(
    db: Session,
    task: Task,
    error: str,
    *,
    retries: int,
    max_retries: int,
) -> None:
    """Record an attempt failure without prematurely marking the task FAILED.

    While a Celery task still has retries left, we only update the
    ``error_message`` (so logs/UI can see why the previous attempt failed)
    and keep ``status=IN_PROGRESS``. Once the final retry is exhausted, the
    task is persisted as FAILED so the client stops polling.

    Pass ``retries=self.request.retries`` and ``max_retries=self.max_retries``
    from a Celery ``bind=True`` task.
    """
    is_final_attempt = retries >= (max_retries or 0)
    task.error_message = error[:1000]
    if is_final_attempt:
        task.status = TaskStatus.FAILED
    else:
        # Keep IN_PROGRESS so polling clients don't give up; the worker
        # will reset progress on the next attempt.
        task.status = TaskStatus.IN_PROGRESS
    db.commit()


_OutputType = Literal["pdf", "zip-of-jpg"]
