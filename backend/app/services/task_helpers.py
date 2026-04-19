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


def ensure_tmp() -> Path:
    SHARED_TMP.mkdir(parents=True, exist_ok=True)
    return SHARED_TMP


async def read_upload(file: UploadFile, *, allowed_mime: set[str] | None = None) -> tuple[bytes, str, str]:
    """Read an UploadFile; enforce size + optional mime whitelist. Returns (data, filename, mime)."""
    data = await file.read()
    if len(data) > MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {MAX_FILE_BYTES // 1024 // 1024}MB limit",
        )
    mime = file.content_type or "application/octet-stream"
    if allowed_mime and mime not in allowed_mime:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type: {mime}",
        )
    return data, file.filename or "upload.bin", mime


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
    """Worker-side finalize. On storage failure, marks the task FAILED and
    re-raises StorageError so the Celery task retry policy can catch it.
    """
    try:
        file_id, file_path, url = storage_service.upload_file(
            result_bytes, filename, task_id=str(task.id)
        )
    except StorageError as exc:
        logger.error("Worker storage upload failed for task %s: %s", task.id, exc)
        task.status = TaskStatus.FAILED
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
    task.status = TaskStatus.FAILED
    task.error_message = error[:1000]
    db.commit()


_OutputType = Literal["pdf", "zip-of-jpg"]
