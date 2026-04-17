import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.task import TaskStatus, TaskType


class TaskStatusOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_type: TaskType
    status: TaskStatus
    progress: int
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime


class TaskResultOut(BaseModel):
    task_id: uuid.UUID
    download_url: str
    expires_in_seconds: int
    original_filename: str
    mime_type: str
    size_bytes: int


class TaskHistoryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    task_type: TaskType
    status: TaskStatus
    progress: int
    created_at: datetime


class TaskHistoryOut(BaseModel):
    items: list[TaskHistoryItem]
    page: int
    page_size: int
    total: int


class BatchStatusOut(BaseModel):
    batch_id: uuid.UUID
    total: int
    completed: int
    failed: int
    pending: int
    results: list[TaskResultOut] = []
    tasks: list[TaskStatusOut] = []
