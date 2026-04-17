import logging
from datetime import datetime, timezone

from sqlalchemy import select

from app.core.celery_app import celery_app
from app.core.database import SyncSessionLocal
from app.models.processed_file import ProcessedFile
from app.services import storage_service

logger = logging.getLogger("imagify.cleanup")


@celery_app.task(name="app.tasks.cleanup_tasks.cleanup_expired_files")
def cleanup_expired_files() -> str:
    """
    Daily background task to identify and remove expired processed files 
    from both ImageKit storage and the local database.
    """
    session = SyncSessionLocal()
    try:
        now = datetime.now(timezone.utc)
        # 1. Query all files past their expiry date
        stmt = select(ProcessedFile).where(ProcessedFile.expires_at < now)
        expired_files = session.execute(stmt).scalars().all()
        
        removed_count = 0
        for pf in expired_files:
            try:
                # 2. Delete the physical asset from ImageKit
                # We do this first so we don't 'lose' the ID if DB delete fails
                storage_service.delete_file(pf.imagekit_file_id)
                
                # 3. Remove the DB record
                # The parent Task remains in history, but its 'processed_file' 
                # relation will now be null/None.
                session.delete(pf)
                removed_count += 1
            except Exception as e:
                logger.error("Failed to clean up expired file record %s: %s", pf.id, str(e))
                continue
                
        session.commit()
        logger.info("Housekeeping finished: %d files deleted.", removed_count)
        return f"Successfully removed {removed_count} expired files."
    finally:
        session.close()
