import uuid

from pydantic import BaseModel, Field


class SyncResultOut(BaseModel):
    task_id: uuid.UUID
    download_url: str
    original_filename: str
    mime_type: str
    size_bytes: int


class AsyncEnqueuedOut(BaseModel):
    task_id: uuid.UUID
    status: str = "pending"


class SplitRange(BaseModel):
    start: int = Field(ge=1)
    end: int = Field(ge=1)
