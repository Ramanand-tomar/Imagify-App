"""Async OCR tasks. Run in Celery worker."""
from __future__ import annotations

import uuid
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal
from app.models.task import Task
from app.services import ocr_service
from app.services.task_helpers import (
    finalize_task_sync,
    load_stashed,
    mark_task_failed_sync,
    remove_stashed_unless_retrying,
)


def _load_task(session, task_id: uuid.UUID) -> Task | None:
    return session.get(Task, task_id)


@celery_app.task(
    bind=True,
    name="app.tasks.ocr_tasks.extract_pdf_text_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    retry_jitter=True,
)
def extract_pdf_text_task(
    self,
    task_row_id: str,
    stash_path: str,
    language: str,
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
        task.progress = 5
        session.commit()

        try:
            data = load_stashed(stash_path)
            text_result = ocr_service.extract_text_from_pdf(data, language=language)
            result_bytes = text_result.encode("utf-8")
        except Exception as exc:
            mark_task_failed_sync(session, task, str(exc))
            raise

        stem = Path(original_filename).stem or "extracted"
        out_name = f"{stem}_text.txt"
        finalize_task_sync(session, task, result_bytes, out_name, "text/plain")
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
