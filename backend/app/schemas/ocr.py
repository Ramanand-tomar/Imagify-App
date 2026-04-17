from __future__ import annotations

import uuid
from typing import List

from pydantic import BaseModel


class OCRResultOut(BaseModel):
    task_id: uuid.UUID
    text: str
    language: str


class OCRLanguagesOut(BaseModel):
    languages: List[str]
