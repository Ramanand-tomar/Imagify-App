import io
import zipfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import storage_service
from app.dependencies import get_current_user, get_db
from app.models.task import TaskType
from app.models.user import User
from app.schemas.pdf import AsyncEnqueuedOut, SyncResultOut
from app.services import pdf_service
from app.services.pdf_service import PdfServiceError
from app.services.task_helpers import (
    create_pending_task_async,
    read_upload,
    record_sync_result,
    stash_bytes,
)

router = APIRouter(prefix="/pdf", tags=["pdf"])

PDF_MIME = {"application/pdf"}
IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/heic"}


def _to_result(task, pf) -> SyncResultOut:
    return SyncResultOut(
        task_id=task.id,
        download_url=storage_service.get_signed_url(pf.imagekit_file_path, expire_seconds=3600),
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
    )


def _service_error(exc: PdfServiceError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---- Sync endpoints ---------------------------------------------------------


@router.post("/merge", response_model=SyncResultOut)
async def merge(
    files: list[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    if not 2 <= len(files) <= 10:
        raise HTTPException(status_code=400, detail="Provide between 2 and 10 PDF files")
    datas: list[bytes] = []
    for f in files:
        data, _, _ = await read_upload(f, allowed_mime=PDF_MIME)
        datas.append(data)
    try:
        merged = pdf_service.merge_pdfs(datas)
    except PdfServiceError as exc:
        raise _service_error(exc)
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=merged, filename="merged.pdf", mime_type="application/pdf",
    )
    return _to_result(task, pf)


@router.post("/split", response_model=SyncResultOut)
async def split(
    file: UploadFile = File(...),
    ranges: str = Form(..., description="Comma-separated 1-indexed ranges, e.g. '1-3,5-7'"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    data, _, _ = await read_upload(file, allowed_mime=PDF_MIME)
    try:
        parsed = _parse_ranges(ranges)
        outputs = pdf_service.split_pdf(data, parsed)
    except PdfServiceError as exc:
        raise _service_error(exc)

    # Bundle multiple ranges into a zip, or single range as PDF
    if len(outputs) == 1:
        result, name, mime = outputs[0], "split.pdf", "application/pdf"
    else:
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for i, out in enumerate(outputs, start=1):
                zf.writestr(f"split_{i}.pdf", out)
        result, name, mime = buf.getvalue(), "split.zip", "application/zip"

    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=result, filename=name, mime_type=mime,
    )
    return _to_result(task, pf)


@router.post("/rotate", response_model=SyncResultOut)
async def rotate(
    file: UploadFile = File(...),
    degrees: int = Form(..., description="90, 180, or 270"),
    pages: str | None = Form(None, description="Comma-separated page numbers, or empty for all"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    data, _, _ = await read_upload(file, allowed_mime=PDF_MIME)
    try:
        page_list = [int(p) for p in pages.split(",")] if pages else None
        rotated = pdf_service.rotate_pdf(data, page_list, degrees)
    except PdfServiceError as exc:
        raise _service_error(exc)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid pages list: {exc}")
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=rotated, filename="rotated.pdf", mime_type="application/pdf",
    )
    return _to_result(task, pf)


@router.post("/page-numbers", response_model=SyncResultOut)
async def page_numbers(
    file: UploadFile = File(...),
    position: str = Form("bottom-center"),
    start_number: int = Form(1),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    data, _, _ = await read_upload(file, allowed_mime=PDF_MIME)
    try:
        out = pdf_service.add_page_numbers(data, position=position, start_number=start_number)
    except PdfServiceError as exc:
        raise _service_error(exc)
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=out, filename="numbered.pdf", mime_type="application/pdf",
    )
    return _to_result(task, pf)


@router.post("/watermark", response_model=SyncResultOut)
async def watermark(
    file: UploadFile = File(...),
    text: str = Form(...),
    opacity: float = Form(0.3),
    font_size: int = Form(48),
    rotation: int = Form(30),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    data, _, _ = await read_upload(file, allowed_mime=PDF_MIME)
    try:
        out = pdf_service.add_watermark_text(
            data, text=text, opacity=opacity, font_size=font_size, rotation=rotation,
        )
    except PdfServiceError as exc:
        raise _service_error(exc)
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=out, filename="watermarked.pdf", mime_type="application/pdf",
    )
    return _to_result(task, pf)


@router.post("/from-images", response_model=SyncResultOut)
async def from_images(
    files: list[UploadFile] = File(...),
    page_size: str = Form("A4"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    if not 1 <= len(files) <= 50:
        raise HTTPException(status_code=400, detail="Provide between 1 and 50 images")
    datas: list[bytes] = []
    for f in files:
        data, _, _ = await read_upload(f, allowed_mime=IMAGE_MIMES)
        datas.append(data)
    try:
        out = pdf_service.images_to_pdf(datas, page_size=page_size)  # type: ignore[arg-type]
    except PdfServiceError as exc:
        raise _service_error(exc)
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=out, filename="from_images.pdf", mime_type="application/pdf",
    )
    return _to_result(task, pf)


@router.post("/protect", response_model=SyncResultOut)
async def protect(
    file: UploadFile = File(...),
    password: str = Form(..., min_length=4),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    data, _, _ = await read_upload(file, allowed_mime=PDF_MIME)
    try:
        out = pdf_service.protect_pdf(data, password)
    except PdfServiceError as exc:
        raise _service_error(exc)
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=out, filename="protected.pdf", mime_type="application/pdf",
    )
    return _to_result(task, pf)


@router.post("/unlock", response_model=SyncResultOut)
async def unlock(
    file: UploadFile = File(...),
    password: str = Form(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    data, _, _ = await read_upload(file, allowed_mime=PDF_MIME)
    try:
        out = pdf_service.unlock_pdf(data, password)
    except PdfServiceError as exc:
        raise _service_error(exc)
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=out, filename="unlocked.pdf", mime_type="application/pdf",
    )
    return _to_result(task, pf)


@router.post("/repair", response_model=SyncResultOut)
async def repair(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncResultOut:
    data, _, _ = await read_upload(file, allowed_mime=PDF_MIME)
    try:
        out = pdf_service.repair_pdf(data)
    except PdfServiceError as exc:
        raise _service_error(exc)
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.PDF,
        result_bytes=out, filename="repaired.pdf", mime_type="application/pdf",
    )
    return _to_result(task, pf)


# ---- Async endpoints (enqueue Celery) ---------------------------------------


@router.post("/compress", response_model=AsyncEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def compress(
    file: UploadFile = File(...),
    quality: str = Form("medium"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncEnqueuedOut:
    if quality not in {"low", "medium", "high"}:
        raise HTTPException(status_code=400, detail="quality must be low, medium, or high")
    data, filename, _ = await read_upload(file, allowed_mime=PDF_MIME)
    stash_path = stash_bytes(data, filename)
    task = await create_pending_task_async(db, user_id=user.id, task_type=TaskType.PDF)

    from app.tasks.pdf_tasks import compress_pdf_task
    async_result = compress_pdf_task.delay(str(task.id), str(stash_path), quality, filename)
    task.celery_task_id = async_result.id
    await db.commit()
    return AsyncEnqueuedOut(task_id=task.id)


@router.post("/to-jpg", response_model=AsyncEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def to_jpg(
    file: UploadFile = File(...),
    quality: int = Form(85),
    dpi: int = Form(150),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncEnqueuedOut:
    if not 30 <= quality <= 100:
        raise HTTPException(status_code=400, detail="quality must be 30-100")
    if not 72 <= dpi <= 300:
        raise HTTPException(status_code=400, detail="dpi must be 72-300")
    data, filename, _ = await read_upload(file, allowed_mime=PDF_MIME)
    stash_path = stash_bytes(data, filename)
    task = await create_pending_task_async(db, user_id=user.id, task_type=TaskType.PDF)

    from app.tasks.pdf_tasks import pdf_to_jpg_task
    async_result = pdf_to_jpg_task.delay(str(task.id), str(stash_path), dpi, quality, filename)
    task.celery_task_id = async_result.id
    await db.commit()
    return AsyncEnqueuedOut(task_id=task.id)


# ---- helpers ----------------------------------------------------------------


def _parse_ranges(raw: str) -> list[tuple[int, int]]:
    result: list[tuple[int, int]] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            result.append((int(a), int(b)))
        else:
            n = int(part)
            result.append((n, n))
    if not result:
        raise PdfServiceError("No valid ranges provided")
    return result
