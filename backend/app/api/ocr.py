import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.models.task import TaskType
from app.schemas.ocr import OCRResultOut, OCRLanguagesOut
from app.schemas.pdf import AsyncEnqueuedOut
from app.services import ocr_service
from app.services.ocr_service import OCRServiceError
from app.services.task_helpers import (
    read_upload,
    record_sync_result,
    stash_bytes,
    create_pending_task_async,
)

logger = logging.getLogger("imagify.ocr")

router = APIRouter(prefix="/ocr", tags=["ocr"])

IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"}
PDF_MIMES = {"application/pdf"}


def _service_error(exc: OCRServiceError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.post("/image", response_model=OCRResultOut)
async def ocr_image(
    file: UploadFile = File(...),
    language: str = Form("eng"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OCRResultOut:
    """Sync OCR on uploaded image.

    The extracted text is returned in the response body, so even if archiving
    the result to storage fails, the user still gets their text back. Storage
    archive is best-effort.
    """
    data, filename, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
    try:
        text = ocr_service.extract_text(data, language=language)
    except OCRServiceError as exc:
        raise _service_error(exc)

    # Best-effort: archive the result to storage so it appears in history.
    # Don't fail the request if storage is unavailable — the user already
    # paid the CPU cost and gets their text back regardless.
    task_id = None
    try:
        result_bytes = text.encode("utf-8")
        task, _ = await record_sync_result(
            db,
            user_id=user.id,
            task_type=TaskType.OCR,
            result_bytes=result_bytes,
            filename=f"{filename}_ocr.txt",
            mime_type="text/plain",
        )
        task_id = task.id
    except HTTPException as exc:
        # record_sync_result raises 502 on storage failure — log and continue.
        logger.warning("OCR archive to storage failed (continuing): %s", exc.detail)
    except Exception:
        logger.exception("OCR archive to storage failed unexpectedly (continuing)")

    return OCRResultOut(task_id=task_id, text=text, language=language)


@router.post("/pdf", response_model=AsyncEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def ocr_pdf(
    file: UploadFile = File(...),
    language: str = Form("eng"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncEnqueuedOut:
    """Async OCR on PDF (Celery task for multi-page)."""
    data, filename, _ = await read_upload(file, allowed_mime=PDF_MIMES)

    stash_path = stash_bytes(data, filename)
    task = await create_pending_task_async(db, user_id=user.id, task_type=TaskType.OCR)

    from app.tasks.ocr_tasks import extract_pdf_text_task

    async_result = extract_pdf_text_task.delay(str(task.id), str(stash_path), language, filename)
    task.celery_task_id = async_result.id
    await db.commit()

    return AsyncEnqueuedOut(task_id=task.id)


@router.get("/languages", response_model=OCRLanguagesOut)
async def get_languages() -> OCRLanguagesOut:
    """Return list of supported Tesseract languages."""
    langs = ocr_service.get_supported_languages()
    return OCRLanguagesOut(languages=langs)
