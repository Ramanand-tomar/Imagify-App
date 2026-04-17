import time
import uuid
from contextlib import contextmanager
from typing import Iterator

from celery import Task as CeleryTask
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SyncSessionLocal
from app.models.task import Task, TaskStatus


@contextmanager
def sync_session() -> Iterator[Session]:
    session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _load_task(session: Session, task_id: uuid.UUID) -> Task | None:
    return session.execute(select(Task).where(Task.id == task_id)).scalar_one_or_none()


def run_stub(celery_task: CeleryTask, task_row_id: str) -> str:
    """Shared stub logic: mark in_progress, sleep, mark success. Used by Phase-1 placeholders."""
    row_id = uuid.UUID(task_row_id)
    with sync_session() as session:
        task = _load_task(session, row_id)
        if task is None:
            return "task-not-found"
        task.status = TaskStatus.IN_PROGRESS
        task.progress = 10
        task.celery_task_id = celery_task.request.id

    time.sleep(0.5)

    with sync_session() as session:
        task = _load_task(session, row_id)
        if task is None:
            return "task-not-found"
        task.status = TaskStatus.SUCCESS
        task.progress = 100

    return "ok"
