import uuid
from pathlib import Path
from typing import Literal

from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal
from app.models.task import Task, TaskStatus
from app.services import image_service
from app.services.task_helpers import (
    finalize_task_sync,
    load_stashed,
    mark_task_failed_sync,
    remove_stashed_unless_retrying,
)


def _load_task(session, task_id: uuid.UUID) -> Task | None:
    return session.get(Task, task_id)


@celery_app.task(
    bind=True,
    name="app.tasks.image_tasks.denoise_ai_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
)
def denoise_ai_task(
    self,
    task_row_id: str,
    stash_path: str,
    h: int,
    original_filename: str
) -> str:
    row_id = uuid.UUID(task_row_id)
    session = SyncSessionLocal()
    succeeded = False
    try:
        task = _load_task(session, row_id)
        if task is None:
            succeeded = True
            return "task-not-found"

        task.status = TaskStatus.IN_PROGRESS
        task.progress = 20
        session.commit()

        try:
            data = load_stashed(stash_path)
            img = image_service.decode_bgr(data)

            # This is slow, so we do it in Celery
            result_img = image_service.denoise_ai(img, h=h)
            result_bytes = image_service.encode_png(result_img)
        except Exception as exc:
            mark_task_failed_sync(session, task, f"Denoise failed: {exc}")
            raise

        out_name = f"denoised-{original_filename}"
        finalize_task_sync(session, task, result_bytes, out_name, "image/png")
        succeeded = True
        return "ok"
    finally:
        remove_stashed_unless_retrying(
            stash_path,
            retries=self.request.retries,
            max_retries=self.max_retries or 0,
            succeeded=succeeded,
        )
        session.close()


@celery_app.task(
    bind=True,
    name="app.tasks.image_tasks.deblur_task",
    max_retries=2,
    autoretry_for=(Exception,),
)
def deblur_task(
    self,
    task_row_id: str,
    stash_path: str,
    blur_type: Literal["motion", "defocus"],
    kernel_size: int,
    noise_power: float,
    original_filename: str,
) -> str:
    row_id = uuid.UUID(task_row_id)
    session = SyncSessionLocal()
    succeeded = False
    try:
        task = _load_task(session, row_id)
        if task is None:
            succeeded = True
            return "task-not-found"

        task.status = TaskStatus.IN_PROGRESS
        task.progress = 10
        session.commit()

        try:
            data = load_stashed(stash_path)
            img = image_service.decode_bgr(data)
            result_img = image_service.deblur_wiener(
                img, blur_type=blur_type, kernel_size=kernel_size, noise_power=noise_power
            )
            result_bytes = image_service.encode_png(result_img)
        except Exception as exc:
            mark_task_failed_sync(session, task, f"Deblur failed: {exc}")
            raise

        out_name = f"deblurred-{original_filename}"
        finalize_task_sync(session, task, result_bytes, out_name, "image/png")
        succeeded = True
        return "ok"
    finally:
        remove_stashed_unless_retrying(
            stash_path,
            retries=self.request.retries,
            max_retries=self.max_retries or 0,
            succeeded=succeeded,
        )
        session.close()


@celery_app.task(
    bind=True,
    name="app.tasks.image_tasks.batch_image_task",
    max_retries=3,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    retry_jitter=True,
)
def batch_image_task(
    self,
    task_row_id: str,
    stash_path: str,
    operation: str,
    params: dict,
    original_filename: str,
) -> str:
    row_id = uuid.UUID(task_row_id)
    session = SyncSessionLocal()
    succeeded = False
    try:
        task = _load_task(session, row_id)
        if not task:
            succeeded = True
            return "not-found"
        task.status = TaskStatus.IN_PROGRESS
        session.commit()

        data = load_stashed(stash_path)
        mime = "image/png"
        out_prefix = operation

        try:
            if operation == "compress":
                res = image_service.compress_image(data, quality=params.get("quality", 75))
                result_bytes, mime = res.data, res.mime_type
            elif operation == "convert":
                res = image_service.convert_format(data, target_format=params.get("format", "png"), quality=params.get("quality", 90))
                result_bytes, mime = res.data, res.mime_type
            elif operation == "resize":
                res = image_service.resize_image(data, width=params.get("width"), height=params.get("height"), maintain_ratio=params.get("maintain_ratio", True))
                result_bytes, mime = res.data, res.mime_type
            elif operation == "histogram":
                res = image_service.generate_histogram_image(data)
                result_bytes, mime = res.data, res.mime_type
            elif operation == "denoise":
                img = image_service.decode_bgr(data)
                processed = image_service.reduce_noise(img, filter_type=params.get("filter_type", "median"), kernel_size=params.get("kernel_size", 3))
                result_bytes = image_service.encode_png(processed)
            else:
                raise ValueError(f"Unknown operation: {operation}")

            # Build a clean filename: <op>-<stem>.<ext> — strip any existing
            # extension from the original so we don't end up with e.g.
            # "compress-photo.jpg.jpg".
            ext = mime.split("/")[-1].replace("jpeg", "jpg")
            stem = Path(original_filename).stem or "output"
            out_name = f"{out_prefix}-{stem}.{ext}"
            finalize_task_sync(session, task, result_bytes, out_name, mime)
            succeeded = True
            return "ok"

        except Exception as exc:
            mark_task_failed_sync(session, task, str(exc))
            raise
    finally:
        remove_stashed_unless_retrying(
            stash_path,
            retries=self.request.retries,
            max_retries=self.max_retries or 0,
            succeeded=succeeded,
        )
        session.close()
