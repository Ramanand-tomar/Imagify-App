"""Async AI tasks: super-resolution and low-light enhancement.

Both read from a stashed source file (written by the API handler), call into
``ai_service``, upload result to ImageKit, mark Task SUCCESS.
"""
from __future__ import annotations

import uuid
from pathlib import Path

from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal
from app.models.task import Task, TaskStatus
from app.services import ai_service
from app.services.task_helpers import (
    finalize_task_sync,
    load_stashed,
    mark_task_failed_sync,
    remove_stashed,
)


def _load_task(session, task_id: uuid.UUID) -> Task | None:
    return session.get(Task, task_id)


def _with_suffix(original: str, suffix: str) -> str:
    stem = Path(original).stem or "output"
    return f"{stem}{suffix}"


@celery_app.task(
    bind=True,
    name="app.tasks.ai_tasks.super_resolution_task",
    max_retries=2,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
)
def super_resolution_task(
    self,
    task_row_id: str,
    stash_path: str,
    scale: int,
    original_filename: str,
) -> str:
    row_id = uuid.UUID(task_row_id)
    session = SyncSessionLocal()
    try:
        task = _load_task(session, row_id)
        if task is None:
            return "task-not-found"

        task.status = TaskStatus.IN_PROGRESS
        task.progress = 10
        session.commit()

        try:
            data = load_stashed(stash_path)
            out_bytes = ai_service.super_resolve(data, scale=scale)
        except Exception as exc:
            mark_task_failed_sync(session, task, str(exc))
            raise

        out_name = _with_suffix(original_filename, f"-x{scale}.png")
        finalize_task_sync(session, task, out_bytes, out_name, "image/png")
        return "ok"
    finally:
        remove_stashed(stash_path)
        session.close()


@celery_app.task(
    bind=True,
    name="app.tasks.ai_tasks.low_light_enhance_task",
    max_retries=2,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
)
def low_light_enhance_task(
    self,
    task_row_id: str,
    stash_path: str,
    strength: float,
    original_filename: str,
) -> str:
    row_id = uuid.UUID(task_row_id)
    session = SyncSessionLocal()
    try:
        task = _load_task(session, row_id)
        if task is None:
            return "task-not-found"

        task.status = TaskStatus.IN_PROGRESS
        task.progress = 10
        session.commit()

        try:
            data = load_stashed(stash_path)
            out_bytes = ai_service.low_light_enhance(data, strength=strength)
        except Exception as exc:
            mark_task_failed_sync(session, task, str(exc))
            raise

        out_name = _with_suffix(original_filename, "-lowlight.png")
        finalize_task_sync(session, task, out_bytes, out_name, "image/png")
        return "ok"
    finally:
        remove_stashed(stash_path)
        session.close()
