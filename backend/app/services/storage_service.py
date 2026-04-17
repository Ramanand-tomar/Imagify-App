from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions

from app.config import settings

if TYPE_CHECKING:
    from imagekitio.models.UploadFileResponse import UploadFileResponse

logger = logging.getLogger("imagify.storage")


def get_imagekit() -> ImageKit:
    """Initialize ImageKit SDK using environment variables."""
    return ImageKit(
        public_key=settings.IMAGEKIT_PUBLIC_KEY,
        private_key=settings.IMAGEKIT_PRIVATE_KEY,
        url_endpoint=settings.IMAGEKIT_URL_ENDPOINT,
    )


def upload_file(
    file_bytes: bytes, 
    filename: str, 
    task_id: str | None = None, 
    folder: str = "processed"
) -> tuple[str, str, str]:
    """
    Uploads a file to ImageKit.
    Returns: (file_id, file_path, url)
    """
    client = get_imagekit()
    
    # Target folder: /imagify/{folder}/{task_id}/
    target_folder = f"/imagify/{folder}"
    if task_id:
        target_folder = f"{target_folder}/{task_id}"
        
    response: UploadFileResponse = client.upload_file(
        file=file_bytes,
        file_name=filename,
        options=UploadFileRequestOptions(
            folder=target_folder,
            use_unique_file_name=True,
        ),
    )
    
    if response.error:
        logger.error("ImageKit upload failed: %s", response.error)
        raise Exception(f"Storage upload failed: {response.error}")
        
    return response.file_id, response.file_path, response.url


def get_signed_url(file_path: str, expire_seconds: int = 3600) -> str:
    """Generate a signed download URL valid for the specified duration."""
    client = get_imagekit()
    return client.url({
        "path": file_path,
        "signed": True,
        "expire_seconds": expire_seconds,
    })


def delete_file(file_id: str) -> bool:
    """Delete a file from ImageKit by its file ID."""
    client = get_imagekit()
    try:
        response = client.delete_file(file_id)
        # ImageKit returns 204 No Content on success
        return response.status_code == 204
    except Exception as e:
        logger.error("Failed to delete file %s from ImageKit: %s", file_id, str(e))
        return False
