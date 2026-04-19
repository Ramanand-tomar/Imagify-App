import base64
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.api.tasks import result_download_url
from app.dependencies import get_current_user, get_db
from app.models.task import Task, TaskType
from app.models.user import User
from app.schemas.image import EnhanceRequest, ImageResultOut, PreviewOut, SessionOut
from app.schemas.pdf import AsyncEnqueuedOut
from app.services import image_service
from app.services.image_service import ImageServiceError
from app.services.task_helpers import (
    create_pending_task_async,
    ensure_tmp,
    read_upload,
    record_sync_result,
    stash_bytes,
)

router = APIRouter(prefix="/image", tags=["image"])


class BatchTaskStartedOut(BaseModel):
    batch_id: uuid.UUID
    task_ids: list[uuid.UUID]


@router.post("/batch", response_model=BatchTaskStartedOut, status_code=status.HTTP_202_ACCEPTED)
async def batch_image(
    files: list[UploadFile] = File(...),
    operation: str = Form(..., description="compress|convert|resize|histogram|denoise"),
    params_json: str = Form("{}", description="JSON string of additional params"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> BatchTaskStartedOut:
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Batch limit is 5 files")
    
    import json
    try:
        params = json.loads(params_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid params_json")

    batch_id = uuid.uuid4()
    task_ids = []

    from app.tasks.image_tasks import batch_image_task
    
    for file in files:
        data, filename, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
        stash_path = stash_bytes(data, filename)
        
        # Create a pending task for each file
        task = await create_pending_task_async(db, user_id=user.id, task_type=TaskType.IMAGE, batch_id=batch_id)
        task_ids.append(task.id)
        
        # Enqueue fan-out
        async_result = batch_image_task.delay(
            str(task.id), str(stash_path), operation, params, filename
        )
        task.celery_task_id = async_result.id

    await db.commit()
    return BatchTaskStartedOut(batch_id=batch_id, task_ids=task_ids)


IMAGE_MIMES = {"image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff", "image/heic"}
SESSIONS_DIR = Path("/tmp/imagify/sessions")
PREVIEW_MAX_EDGE = 1024  # downscale preview for speed


def _service_error(exc: ImageServiceError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _session_path(session_id: str) -> Path:
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    # sanitize — non-empty hex (uuid4().hex is 32 chars; allow up to 64 for safety)
    if not session_id or not (8 <= len(session_id) <= 64):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    if not all(c in "0123456789abcdef-" for c in session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    return SESSIONS_DIR / f"{session_id}.bin"


def _load_session_bytes(session_id: str) -> bytes:
    path = _session_path(session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return path.read_bytes()


def _apply_enhancement(data: bytes, op: str, params: dict[str, Any]):
    img = image_service.decode_bgr(data)
    if op == "clahe":
        return image_service.apply_clahe(img, clip_limit=float(params.get("clip_limit", 2.0)),
                                         tile_size=int(params.get("tile_size", 8)))
    if op == "contrast":
        return image_service.stretch_contrast(img, contrast_pct=float(params.get("contrast_pct", 0.0)),
                                              brightness=int(params.get("brightness", 0)))
    if op == "sharpen":
        return image_service.unsharp_mask(img, strength=float(params.get("strength", 1.0)),
                                          radius=float(params.get("radius", 1.5)))
    if op == "denoise":
        return image_service.reduce_noise(img, filter_type=params.get("filter_type", "median"),
                                          kernel_size=int(params.get("kernel_size", 3)))
    if op == "edges":
        return image_service.detect_edges(img, operator=params.get("operator", "canny"),
                                          low_thresh=int(params.get("low_thresh", 100)),
                                          high_thresh=int(params.get("high_thresh", 200)))
    if op == "denoise-ai":
        return image_service.denoise_ai(img, h=int(params.get("h", 10)))
    if op == "deblur":
        return image_service.deblur_wiener(
            img, 
            blur_type=params.get("blur_type", "motion"),
            kernel_size=int(params.get("kernel_size", 15)),
            noise_power=float(params.get("noise_power", 0.01))
        )
    if op == "homomorphic":
        return image_service.homomorphic_filter(
            img, 
            gamma_low=float(params.get("gamma_low", 0.5)),
            gamma_high=float(params.get("gamma_high", 2.0)),
            cutoff=float(params.get("cutoff", 30.0))
        )
    raise ImageServiceError(f"Unknown operation: {op}")


# ---- Session ---------------------------------------------------------------


@router.post("/session", response_model=SessionOut)
async def create_session(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
) -> SessionOut:
    data, _, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
    try:
        img = image_service.decode_bgr(data)
    except ImageServiceError as exc:
        raise _service_error(exc)

    session_id = uuid.uuid4().hex
    ensure_tmp()
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
    (SESSIONS_DIR / f"{session_id}.bin").write_bytes(data)

    # Build a downscaled preview for UI
    h, w = img.shape[:2]
    scale = min(PREVIEW_MAX_EDGE / max(h, w), 1.0)
    if scale < 1.0:
        import cv2
        preview = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    else:
        preview = img
    preview_bytes = image_service.encode_jpeg(preview, quality=80)
    return SessionOut(
        session_id=session_id,
        width=w,
        height=h,
        preview_base64=base64.b64encode(preview_bytes).decode("ascii"),
    )


@router.post("/enhance/preview", response_model=PreviewOut)
async def preview(
    body: EnhanceRequest,
    user: User = Depends(get_current_user),
) -> PreviewOut:
    data = _load_session_bytes(body.session_id)
    try:
        result_img = _apply_enhancement(data, body.operation, body.params)
    except ImageServiceError as exc:
        raise _service_error(exc)

    # downscale preview for speed
    import cv2
    h, w = result_img.shape[:2]
    scale = min(PREVIEW_MAX_EDGE / max(h, w), 1.0)
    if scale < 1.0:
        result_img = cv2.resize(result_img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    encoded = image_service.encode_jpeg(result_img, quality=80)
    return PreviewOut(preview_base64=base64.b64encode(encoded).decode("ascii"))


@router.post("/enhance/apply", response_model=ImageResultOut)
async def apply_enhancement(
    body: EnhanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImageResultOut:
    data = _load_session_bytes(body.session_id)
    try:
        result_img = _apply_enhancement(data, body.operation, body.params)
        result_bytes = image_service.encode_png(result_img)
    except ImageServiceError as exc:
        raise _service_error(exc)

    filename = f"{body.operation}.png"
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.IMAGE,
        result_bytes=result_bytes, filename=filename, mime_type="image/png",
    )
    h, w = result_img.shape[:2]
    return ImageResultOut(
        task_id=task.id,
        download_url=result_download_url(pf, task.id),
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
        width=w,
        height=h,
    )


# ---- Utilities (one-shot, no session) --------------------------------------


@router.post("/convert", response_model=ImageResultOut)
async def convert(
    file: UploadFile = File(...),
    target_format: str = Form(..., description="jpeg|png|webp|bmp|tiff"),
    quality: int = Form(90),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImageResultOut:
    data, _, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
    try:
        out = image_service.convert_format(data, target_format=target_format, quality=quality)  # type: ignore[arg-type]
    except ImageServiceError as exc:
        raise _service_error(exc)

    filename = f"converted.{target_format}"
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.IMAGE,
        result_bytes=out.data, filename=filename, mime_type=out.mime_type,
    )
    return ImageResultOut(
        task_id=task.id,
        download_url=result_download_url(pf, task.id),
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
        width=out.width,
        height=out.height,
    )


@router.post("/compress", response_model=ImageResultOut)
async def compress(
    file: UploadFile = File(...),
    quality: int = Form(75),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImageResultOut:
    data, _, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
    try:
        out = image_service.compress_image(data, quality=quality)
    except ImageServiceError as exc:
        raise _service_error(exc)

    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.IMAGE,
        result_bytes=out.data, filename="compressed.jpg", mime_type=out.mime_type,
    )
    return ImageResultOut(
        task_id=task.id,
        download_url=result_download_url(pf, task.id),
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
        width=out.width,
        height=out.height,
    )


# ---- AI async endpoints -----------------------------------------------------


async def _enqueue_from_session(
    session_id: str,
    db: AsyncSession,
    user: User,
) -> tuple[Task, str, str]:
    """Copy a session's source image to the ephemeral stash + create a pending Task."""
    session_file = _session_path(session_id)
    if not session_file.exists():
        raise HTTPException(status_code=404, detail="Session not found")
    data = session_file.read_bytes()
    filename = f"{session_id}.png"
    stash_path = stash_bytes(data, filename)
    task = await create_pending_task_async(db, user_id=user.id, task_type=TaskType.AI)
    return task, str(stash_path), filename


@router.post("/enhance/super-res/session", response_model=AsyncEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def super_res_from_session(
    body: EnhanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncEnqueuedOut:
    scale = int(body.params.get("scale", 2))
    if scale not in (2, 3, 4):
        raise HTTPException(status_code=400, detail="scale must be 2, 3, or 4")
    task, stash_path, filename = await _enqueue_from_session(body.session_id, db, user)

    from app.tasks.ai_tasks import super_resolution_task
    async_result = super_resolution_task.delay(str(task.id), stash_path, scale, filename)
    task.celery_task_id = async_result.id
    await db.commit()
    return AsyncEnqueuedOut(task_id=task.id)


@router.post("/enhance/lowlight/session", response_model=AsyncEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def lowlight_from_session(
    body: EnhanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncEnqueuedOut:
    strength = float(body.params.get("strength", 1.0))
    if not 0 <= strength <= 2:
        raise HTTPException(status_code=400, detail="strength must be in [0, 2]")
    task, stash_path, filename = await _enqueue_from_session(body.session_id, db, user)

    from app.tasks.ai_tasks import low_light_enhance_task
    async_result = low_light_enhance_task.delay(str(task.id), stash_path, strength, filename)
    task.celery_task_id = async_result.id
    await db.commit()
    return AsyncEnqueuedOut(task_id=task.id)


@router.post("/enhance/super-res", response_model=AsyncEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def super_res(
    file: UploadFile = File(...),
    scale: int = Form(2),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncEnqueuedOut:
    if scale not in (2, 3, 4):
        raise HTTPException(status_code=400, detail="scale must be 2, 3, or 4")
    data, filename, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
    stash_path = stash_bytes(data, filename)
    task = await create_pending_task_async(db, user_id=user.id, task_type=TaskType.AI)

    from app.tasks.ai_tasks import super_resolution_task
    async_result = super_resolution_task.delay(str(task.id), str(stash_path), scale, filename)
    task.celery_task_id = async_result.id
    await db.commit()
    return AsyncEnqueuedOut(task_id=task.id)


@router.post("/enhance/lowlight", response_model=AsyncEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def low_light(
    file: UploadFile = File(...),
    strength: float = Form(1.0),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncEnqueuedOut:
    if not 0 <= strength <= 2:
        raise HTTPException(status_code=400, detail="strength must be in [0, 2]")
    data, filename, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
    stash_path = stash_bytes(data, filename)
    task = await create_pending_task_async(db, user_id=user.id, task_type=TaskType.AI)

    from app.tasks.ai_tasks import low_light_enhance_task
    async_result = low_light_enhance_task.delay(str(task.id), str(stash_path), strength, filename)
    task.celery_task_id = async_result.id
    await db.commit()
    return AsyncEnqueuedOut(task_id=task.id)


@router.post("/enhance/denoise-ai/session", response_model=AsyncEnqueuedOut, status_code=status.HTTP_202_ACCEPTED)
async def denoise_ai_from_session(
    body: EnhanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AsyncEnqueuedOut:
    """Async AI Denoising from session. Specified in DIP Unit III."""
    h = int(body.params.get("h", 10))
    task, stash_path, filename = await _enqueue_from_session(body.session_id, db, user)

    from app.tasks.image_tasks import denoise_ai_task
    async_result = denoise_ai_task.delay(str(task.id), stash_path, h, filename)
    task.celery_task_id = async_result.id
    await db.commit()
    return AsyncEnqueuedOut(task_id=task.id)


@router.post("/enhance/deblur/session", response_model=ImageResultOut | AsyncEnqueuedOut)
async def deblur_from_session(
    body: EnhanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImageResultOut | AsyncEnqueuedOut:
    """Deblurring. Sync for < 2MP, Async for larger. Specified in DIP Unit III."""
    data = _load_session_bytes(body.session_id)
    img = image_service.decode_bgr(data)
    h, w = img.shape[:2]

    blur_type = body.params.get("blur_type", "motion")
    kernel_size = int(body.params.get("kernel_size", 15))
    noise_power = float(body.params.get("noise_power", 0.01))

    if h * w < 2_000_000:
        # Sync path
        try:
            result_img = image_service.deblur_wiener(
                img, blur_type=blur_type, kernel_size=kernel_size, noise_power=noise_power
            )
            result_bytes = image_service.encode_png(result_img)
        except ImageServiceError as exc:
            raise _service_error(exc)

        task, pf = await record_sync_result(
            db, user_id=user.id, task_type=TaskType.IMAGE,
            result_bytes=result_bytes, filename="deblurred.png", mime_type="image/png",
        )
        return ImageResultOut(
            task_id=task.id,
            download_url=result_download_url(pf, task.id),
            original_filename=pf.original_filename,
            mime_type=pf.mime_type,
            size_bytes=pf.size_bytes,
            width=w, height=h,
        )
    else:
        # Async path
        task, stash_path, filename = await _enqueue_from_session(body.session_id, db, user)
        from app.tasks.image_tasks import deblur_task
        async_result = deblur_task.delay(str(task.id), stash_path, blur_type, kernel_size, noise_power, filename)
        task.celery_task_id = async_result.id
        await db.commit()
        return AsyncEnqueuedOut(task_id=task.id)


@router.post("/enhance/homomorphic/session", response_model=ImageResultOut)
async def homomorphic_from_session(
    body: EnhanceRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImageResultOut:
    """Homomorphic filtering (illumination normalization). Sync. Specified in DIP Unit III."""
    data = _load_session_bytes(body.session_id)
    try:
        result_img = _apply_enhancement(data, "homomorphic", body.params)
        result_bytes = image_service.encode_png(result_img)
    except ImageServiceError as exc:
        raise _service_error(exc)

    h, w = result_img.shape[:2]
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.IMAGE,
        result_bytes=result_bytes, filename="homomorphic.png", mime_type="image/png",
    )
    return ImageResultOut(
        task_id=task.id,
        download_url=result_download_url(pf, task.id),
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
        width=w, height=h,
    )


@router.post("/resize", response_model=ImageResultOut)
async def resize(
    file: UploadFile = File(...),
    width: int | None = Form(None),
    height: int | None = Form(None),
    maintain_ratio: bool = Form(True),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImageResultOut:
    data, filename, _ = await read_upload(file, allowed_mime=IMAGE_MIMES)
    try:
        out = image_service.resize_image(data, width=width, height=height, maintain_ratio=maintain_ratio)
    except ImageServiceError as exc:
        raise _service_error(exc)

    suffix = Path(filename).suffix or ".png"
    out_name = f"resized{suffix}"
    task, pf = await record_sync_result(
        db, user_id=user.id, task_type=TaskType.IMAGE,
        result_bytes=out.data, filename=out_name, mime_type=out.mime_type,
    )
    return ImageResultOut(
        task_id=task.id,
        download_url=result_download_url(pf, task.id),
        original_filename=pf.original_filename,
        mime_type=pf.mime_type,
        size_bytes=pf.size_bytes,
        width=out.width,
        height=out.height,
    )
