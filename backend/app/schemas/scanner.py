import uuid
from typing import Literal

from pydantic import BaseModel, Field


class ScannerSessionOut(BaseModel):
    session_id: str
    width: int
    height: int
    preview_base64: str


class Corner(BaseModel):
    x: float = Field(ge=0)
    y: float = Field(ge=0)


class DetectEdgesRequest(BaseModel):
    session_id: str


class DetectEdgesOut(BaseModel):
    corners: list[Corner]  # TL, TR, BR, BL


class PerspectiveRequest(BaseModel):
    session_id: str
    corners: list[Corner] = Field(min_length=4, max_length=4)


class StepRequest(BaseModel):
    session_id: str


class BinarizeRequest(BaseModel):
    session_id: str
    method: Literal["otsu", "adaptive", "none"] = "adaptive"
    block_size: int = 31
    c: int = 10


class ProcessRequest(BaseModel):
    session_id: str
    corners: list[Corner] | None = None
    do_deskew: bool = True
    do_shadow_removal: bool = True
    binarize: Literal["otsu", "adaptive", "none"] = "adaptive"
    adaptive_block_size: int = 31
    adaptive_c: int = 10
    export_as: Literal["image", "pdf"] = "image"


class ScannerPreviewOut(BaseModel):
    preview_base64: str
    mime_type: str = "image/jpeg"


class ScannerResultOut(BaseModel):
    task_id: uuid.UUID
    download_url: str
    original_filename: str
    mime_type: str
    size_bytes: int
    width: int
    height: int
