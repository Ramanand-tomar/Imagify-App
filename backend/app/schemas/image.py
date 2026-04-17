import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

Operation = Literal["clahe", "contrast", "sharpen", "denoise", "edges", "denoise-ai", "deblur", "homomorphic"]


class SessionOut(BaseModel):
    session_id: str
    width: int
    height: int
    preview_base64: str


class EnhanceRequest(BaseModel):
    session_id: str
    operation: Operation
    params: dict[str, Any] = Field(default_factory=dict)


class PreviewOut(BaseModel):
    preview_base64: str
    mime_type: str = "image/jpeg"


class ImageResultOut(BaseModel):
    task_id: uuid.UUID
    download_url: str
    original_filename: str
    mime_type: str
    size_bytes: int
    width: int
    height: int
