"""Async PDF tasks (compress, pdf-to-jpg). Run in Celery worker.

Service functions operate on raw bytes; these wrappers handle DB state + ImageKit
upload via the sync task_helpers API.
"""
from __future__ import annotations

import io
import uuid
import zipfile
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal
from app.models.task import Task
from app.services import pdf_service
from app.services.task_helpers import (
    finalize_task_sync,
    load_stashed,
    record_task_attempt_failure_sync,
    remove_stashed_unless_retrying,
)


def _load_task(session, task_id: uuid.UUID) -> Task | None:
    return session.get(Task, task_id)


@celery_app.task(
    bind=True,
    name="app.tasks.pdf_tasks.compress_pdf_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
)
def compress_pdf_task(
    self,
    task_row_id: str,
    stash_path: str,
    quality: str,
    original_filename: str,
) -> str:
    row_id = uuid.UUID(task_row_id)
    session = SyncSessionLocal()
    succeeded = False
    try:
        task = _load_task(session, row_id)
        if task is None:
            succeeded = True  # nothing to retry
            return "task-not-found"

        from app.models.task import TaskStatus
        task.status = TaskStatus.IN_PROGRESS
        task.progress = 10
        session.commit()

        try:
            data = load_stashed(stash_path)
            compressed = pdf_service.compress_pdf(data, quality=quality)  # type: ignore[arg-type]
        except Exception as exc:
            record_task_attempt_failure_sync(
                session, task, str(exc),
                retries=self.request.retries,
                max_retries=self.max_retries or 0,
            )
            raise

        out_name = _with_suffix(original_filename, "-compressed.pdf")
        try:
            finalize_task_sync(session, task, compressed, out_name, "application/pdf")
        except Exception as exc:
            record_task_attempt_failure_sync(
                session, task, str(exc),
                retries=self.request.retries,
                max_retries=self.max_retries or 0,
            )
            raise
        succeeded = True
        return "ok"
    finally:
        remove_stashed_unless_retrying(
            stash_path,
            retries=self.request.retries,
            max_retries=self.max_retries or 0,
            succeeded=succeeded,
        )
        session.close()


@celery_app.task(
    bind=True,
    name="app.tasks.pdf_tasks.pdf_to_jpg_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
)
def pdf_to_jpg_task(
    self,
    task_row_id: str,
    stash_path: str,
    dpi: int,
    quality: int,
    original_filename: str,
) -> str:
    row_id = uuid.UUID(task_row_id)
    session = SyncSessionLocal()
    succeeded = False
    try:
        task = _load_task(session, row_id)
        if task is None:
            succeeded = True
            return "task-not-found"

        from app.models.task import TaskStatus
        task.status = TaskStatus.IN_PROGRESS
        task.progress = 10
        session.commit()

        try:
            data = load_stashed(stash_path)
            pages = pdf_service.pdf_to_jpg(data, dpi=dpi, quality=quality)
        except Exception as exc:
            record_task_attempt_failure_sync(
                session, task, str(exc),
                retries=self.request.retries,
                max_retries=self.max_retries or 0,
            )
            raise

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for p in pages:
                zf.writestr(p.filename, p.bytes)
        out_name = _with_suffix(original_filename, "-pages.zip")
        try:
            finalize_task_sync(session, task, buf.getvalue(), out_name, "application/zip")
        except Exception as exc:
            record_task_attempt_failure_sync(
                session, task, str(exc),
                retries=self.request.retries,
                max_retries=self.max_retries or 0,
            )
            raise
        succeeded = True
        return "ok"
    finally:
        remove_stashed_unless_retrying(
            stash_path,
            retries=self.request.retries,
            max_retries=self.max_retries or 0,
            succeeded=succeeded,
        )
        session.close()


def _with_suffix(original: str, suffix: str) -> str:
    stem = Path(original).stem or "output"
    return f"{stem}{suffix}"
