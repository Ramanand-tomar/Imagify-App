from dataclasses import dataclass
from functools import lru_cache

from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions

from app.config import settings


@dataclass
class UploadResult:
    file_id: str
    url: str
    file_path: str


@lru_cache
def get_imagekit() -> ImageKit:
    return ImageKit(
        public_key=settings.IMAGEKIT_PUBLIC_KEY,
        private_key=settings.IMAGEKIT_PRIVATE_KEY,
        url_endpoint=settings.IMAGEKIT_URL_ENDPOINT,
    )


def upload_file(file_bytes: bytes, filename: str, folder: str = "/imagify") -> UploadResult:
    client = get_imagekit()
    response = client.upload_file(
        file=file_bytes,
        file_name=filename,
        options=UploadFileRequestOptions(folder=folder, use_unique_file_name=True),
    )
    return UploadResult(file_id=response.file_id, url=response.url, file_path=response.file_path)


def get_signed_url(file_path: str, expires_in: int = 3600) -> str:
    client = get_imagekit()
    return client.url({"path": file_path, "signed": True, "expire_seconds": expires_in})
