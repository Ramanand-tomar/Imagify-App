import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal
from app.models.processed_file import ProcessedFile
from app.services import storage_service

logger = logging.getLogger("imagify.cleanup")


@celery_app.task(name="app.tasks.cleanup_tasks.cleanup_expired_files")
def cleanup_expired_files() -> dict[str, int]:
    """Daily background task: delete expired ImageKit files + their DB rows.

    Behaviour for each expired ``ProcessedFile``:

    - ImageKit responds 204 → DB row deleted (success).
    - ImageKit responds 404 → DB row deleted (already absent on storage).
    - ImageKit transient error (5xx, 429, network) → DB row KEPT for retry
      on the next run; a warning is logged with the reason.
    - ImageKit permanent error (auth, unexpected status) → DB row KEPT
      so an operator can inspect; an error is logged.

    Returns a dict of counts so beat logs and any future metrics endpoint
    can show what the run did.
    """
    session = SyncSessionLocal()
    counts = {"scanned": 0, "deleted": 0, "kept_transient": 0, "kept_permanent": 0}
    try:
        now = datetime.now(timezone.utc)
        expired = session.execute(
            select(ProcessedFile).where(ProcessedFile.expires_at < now)
        ).scalars().all()
        counts["scanned"] = len(expired)

        for pf in expired:
            try:
                result = storage_service.delete_file(pf.imagekit_file_id)
            except Exception as exc:  # storage_service should never raise but be safe
                logger.exception(
                    "Cleanup: unexpected exception deleting %s (file_id=%s)",
                    pf.id, pf.imagekit_file_id,
                )
                counts["kept_transient"] += 1
                continue

            if result.is_safe_to_drop:
                # ImageKit confirms file is gone — drop our row too.
                session.delete(pf)
                counts["deleted"] += 1
                logger.info(
                    "Cleanup: removed pf=%s file_id=%s (status=%s)",
                    pf.id, pf.imagekit_file_id, result.status,
                )
            elif result.status == "transient":
                counts["kept_transient"] += 1
                logger.warning(
                    "Cleanup: KEEPING pf=%s file_id=%s — transient: %s",
                    pf.id, pf.imagekit_file_id, result.reason,
                )
            else:
                counts["kept_permanent"] += 1
                logger.error(
                    "Cleanup: KEEPING pf=%s file_id=%s — permanent: %s "
                    "(operator action needed)",
                    pf.id, pf.imagekit_file_id, result.reason,
                )

        session.commit()
        logger.info(
            "Cleanup run finished: scanned=%(scanned)d deleted=%(deleted)d "
            "kept_transient=%(kept_transient)d kept_permanent=%(kept_permanent)d",
            counts,
        )
        return counts
    finally:
        session.close()
