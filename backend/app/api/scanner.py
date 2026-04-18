import base64
import io
import uuid
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.tasks import download_url_for
from app.dependencies import get_current_user, get_db
from app.models.task import TaskType
from app.models.user import User
from app.schemas.scanner import (
    BinarizeRequest,
    Corner,
    DetectEdgesOut,
    DetectEdgesRequest,
    PerspectiveRequest,
    ProcessRequest,
    ScannerPreviewOut,
    ScannerResultOut,
    ScannerSessionOut,
    StepRequest,
)
from app.services import image_service, pdf_service, scanner_service
from app.services.image_service import ImageServiceError
from app.services.scanner_service import ScanConfig
from app.services.task_helpers import ensure_tmp, read_upload, record_sync_result

router = APIRouter(prefix="/scanner", tags=["scanner"])

IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff", "image/heic"}
SESSIONS_DIR = Path("/tmp/imagify/scanner")
PREVIEW_MAX_EDGE = 1280


def _session_path(session_id: str) -> Path:
    if not all(c in "0123456789abcdef-" for c in session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    return SESSIONS_DIR / f"{session_id}.bin"


def _load_bytes(session_id: str) -> bytes:
    path = _session_path(session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return path.read_bytes()


def _to_preview_b64(img: np.ndarray) -> str:
    h, w = img.shape[:2]
    scale = min(PREVIEW_MAX_EDGE / max(h, w), 1.0)
    if scale < 1.0:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    jpg = image_service.encode_jpeg(img, quality=82)
    return base64.b64encode(jpg).decode("ascii")


def _service_error(exc: ImageServiceError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---- 1. Session ------------------------------------------------------------


@router.post("/session", response_model=ScannerSessionOut)
async def create_session(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> ScannerSessionOut:
    data, _, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
    try:
        img = image_service.decode_bgr(data)
    except ImageServiceError as exc:
        raise _service_error(exc)

    ensure_tmp()
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    session_id = uuid.uuid4().hex
    _session_path(session_id).write_bytes(data)

    h, w = img.shape[:2]
    return ScannerSessionOut(
        session_id=session_id,
        width=w,
        height=h,
        preview_base64=_to_preview_b64(img),
    )


# ---- 2. Detect edges -------------------------------------------------------


@router.post("/detect-edges", response_model=DetectEdgesOut)
async def detect_edges(
    body: DetectEdgesRequest,
    user: User = Depends(get_current_user),
) -> DetectEdgesOut:
    img = image_service.decode_bgr(_load_bytes(body.session_id))
    corners = scanner_service.detect_document_edges(img)
    return DetectEdgesOut(corners=[Corner(x=x, y=y) for x, y in corners])


# ---- 3. Correct perspective preview ----------------------------------------


@router.post("/correct-perspective", response_model=ScannerPreviewOut)
async def correct_perspective_preview(
    body: PerspectiveRequest,
    user: User = Depends(get_current_user),
) -> ScannerPreviewOut:
    img = image_service.decode_bgr(_load_bytes(body.session_id))
    try:
        out = scanner_service.correct_perspective(img, [(c.x, c.y) for c in body.corners])
    except ImageServiceError as exc:
        raise _service_error(exc)
    return ScannerPreviewOut(preview_base64=_to_preview_b64(out))


# ---- 4. Deskew preview -----------------------------------------------------


@router.post("/deskew", response_model=ScannerPreviewOut)
async def deskew_preview(
    body: StepRequest,
    user: User = Depends(get_current_user),
) -> ScannerPreviewOut:
    img = image_service.decode_bgr(_load_bytes(body.session_id))
    out = scanner_service.deskew(img)
    return ScannerPreviewOut(preview_base64=_to_preview_b64(out))


# ---- 5. Binarize preview ---------------------------------------------------


@router.post("/binarize", response_model=ScannerPreviewOut)
async def binarize_preview(
    body: BinarizeRequest,
    user: User = Depends(get_current_user),
) -> ScannerPreviewOut:
    img = image_service.decode_bgr(_load_bytes(body.session_id))
    try:
        out = scanner_service.binarize(img, method=body.method, block_size=body.block_size, c=body.c)
    except ImageServiceError as exc:
        raise _service_error(exc)
    return ScannerPreviewOut(preview_base64=_to_preview_b64(out))


# ---- 6. Full process + save ------------------------------------------------


@router.post("/process", response_model=ScannerResultOut)
async def process(
    body: ProcessRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ScannerResultOut:
    img = image_service.decode_bgr(_load_bytes(body.session_id))
    corners = [(c.x, c.y) for c in body.corners] if body.corners else None
    config = ScanConfig(
        corners=corners,
        do_deskew=body.do_deskew,
        do_shadow_removal=body.do_shadow_removal,
        binarize=body.binarize,
        adaptive_block_size=body.adaptive_block_size,
        adaptive_c=body.adaptive_c,
    )
    try:
        result_img = scanner_service.full_scan_pipeline(img, config)
    except ImageServiceError as exc:
        raise _service_error(exc)

    if body.export_as == "pdf":
        # Re-encode scanned image as JPEG, then wrap in PDF via existing service
        jpeg_bytes = image_service.encode_jpeg(result_img, quality=90)
        pdf_bytes = pdf_service.images_to_pdf([jpeg_bytes], page_size="A4")
        filename, mime, payload = "scan.pdf", "application/pdf", pdf_bytes
    else:
        payload = image_service.encode_jpeg(result_img, quality=92)
        filename, mime = "scan.jpg", "image/jpeg"

    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.IMAGE,
        result_bytes=payload, filename=filename, mime_type=mime,
    )
    h, w = result_img.shape[:2]
    return ScannerResultOut(
        task_id=task.id,
        download_url=download_url_for(task.id),
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
        width=w,
        height=h,
    )
