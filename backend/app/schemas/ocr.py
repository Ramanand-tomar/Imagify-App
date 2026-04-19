from __future__ import annotations

import uuid
from typing import List

from pydantic import BaseModel


class OCRResultOut(BaseModel):
    # task_id may be None if storage archive failed but OCR succeeded —
    # the client should still display `text` to the user.
    task_id: uuid.UUID | None = None
    text: str
    language: str


class OCRLanguagesOut(BaseModel):
    languages: List[str]
