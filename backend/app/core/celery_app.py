from celery import Celery

from app.config import settings

from celery.schedules import crontab

celery_app = Celery(
    "imagify",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=[
        "app.tasks.pdf_tasks", 
        "app.tasks.image_tasks", 
        "app.tasks.ai_tasks", 
        "app.tasks.ocr_tasks",
        "app.tasks.cleanup_tasks"
    ],
)

celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_default_retry_delay=5,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    worker_prefetch_multiplier=1,
)

celery_app.conf.beat_schedule = {
    "cleanup-expired-files-daily": {
        "task": "app.tasks.cleanup_tasks.cleanup_expired_files",
        "schedule": crontab(hour=2, minute=0),
    },
}
