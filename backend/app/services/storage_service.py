from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions

from app.config import settings

if TYPE_CHECKING:
    from imagekitio.models.UploadFileResponse import UploadFileResponse

logger = logging.getLogger("imagify.storage")


class StorageError(RuntimeError):
    """Raised when ImageKit upload / signing / fetch fails."""


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
    folder: str = "processed",
) -> tuple[str, str, str]:
    """
    Uploads a file to ImageKit.
    Returns: (file_id, file_path, url)

    Raises:
        StorageError: if the upload fails or returns an unusable response.
    """
    client = get_imagekit()

    target_folder = f"/imagify/{folder}"
    if task_id:
        target_folder = f"{target_folder}/{task_id}"

    try:
        response: UploadFileResponse = client.upload_file(
            file=file_bytes,
            file_name=filename,
            options=UploadFileRequestOptions(
                folder=target_folder,
                use_unique_file_name=True,
            ),
        )
    except Exception as exc:
        logger.exception("ImageKit SDK raised during upload of %s", filename)
        raise StorageError(f"Storage upload failed: {exc}") from exc

    if getattr(response, "error", None):
        logger.error("ImageKit upload failed: %s", response.error)
        raise StorageError(f"Storage upload failed: {response.error}")

    file_id = getattr(response, "file_id", None)
    file_path = getattr(response, "file_path", None)
    url = getattr(response, "url", None)

    if not file_id or not file_path:
        # Without these, we cannot generate a signed URL later — fail loudly.
        logger.error(
            "ImageKit returned incomplete upload response: file_id=%s file_path=%s url=%s",
            file_id, file_path, url,
        )
        raise StorageError("Storage upload returned incomplete response (missing file metadata)")

    if not url:
        # Some SDK versions / private accounts may not return a URL — we'll
        # always re-sign on download anyway, so this is just a warning.
        logger.warning("ImageKit upload missing url field for file_path=%s; will sign on demand", file_path)
        url = ""

    return file_id, file_path, url


def get_signed_url(file_path: str, expire_seconds: int = 3600) -> str:
    """Generate a signed download URL valid for ``expire_seconds``.

    Uses the file_path (e.g. ``/imagify/processed/<task>/merged.pdf``) which
    we always store at upload time. Works for both private files and accounts
    that restrict unsigned URLs.
    """
    if not file_path:
        raise StorageError("get_signed_url called with empty file_path")
    client = get_imagekit()
    try:
        signed = client.url({
            "path": file_path,
            "signed": True,
            "expire_seconds": expire_seconds,
        })
    except Exception as exc:
        logger.exception("Failed to build signed URL for %s", file_path)
        raise StorageError(f"Could not sign URL: {exc}") from exc
    if not signed or not isinstance(signed, str):
        raise StorageError("ImageKit signing returned an empty URL")
    return signed


class DeleteResult:
    """Outcome of a ``delete_file`` call.

    - ``ok``: server acknowledged deletion (204) — safe to drop the DB row.
    - ``not_found``: file already absent on ImageKit (404) — also safe to
      drop the DB row, the storage state is already what we want.
    - ``transient``: network/5xx/auth issue — KEEP the DB row so a future
      cleanup pass can retry. ``reason`` carries an actionable message.
    - ``permanent``: ImageKit rejected with a non-retryable error — KEEP
      the row so an operator can inspect.
    """

    __slots__ = ("status", "reason")

    def __init__(self, status: str, reason: str = "") -> None:
        self.status = status
        self.reason = reason

    @property
    def is_safe_to_drop(self) -> bool:
        return self.status in ("ok", "not_found")


def delete_file(file_id: str) -> DeleteResult:
    """Delete a file from ImageKit by its file ID. See ``DeleteResult``."""
    if not file_id:
        return DeleteResult("permanent", "empty file_id")
    client = get_imagekit()
    try:
        response = client.delete_file(file_id)
    except Exception as e:
        msg = f"{type(e).__name__}: {e}"
        logger.warning("ImageKit delete %s raised: %s", file_id, msg)
        return DeleteResult("transient", msg)

    code = getattr(response, "status_code", None)
    if code == 204:
        return DeleteResult("ok")
    if code == 404:
        # Already gone — treat as success for cleanup purposes.
        return DeleteResult("not_found", "ImageKit returned 404 (already absent)")
    if code in (401, 403):
        return DeleteResult("permanent", f"ImageKit returned {code} (auth/permission)")
    if code in (429, 500, 502, 503, 504):
        return DeleteResult("transient", f"ImageKit returned {code}")
    return DeleteResult("permanent", f"ImageKit returned unexpected status {code}")


def storage_healthcheck() -> tuple[bool, str]:
    """Cheap health probe — verifies SDK is constructible and a signing call
    against a placeholder path doesn't blow up. Returns (ok, detail).
    """
    try:
        client = get_imagekit()
        # signing a probe path should not require a network call
        url = client.url({"path": "/healthcheck.txt", "signed": True, "expire_seconds": 60})
        if not url:
            return False, "signed URL was empty"
        return True, "ok"
    except Exception as exc:  # pragma: no cover
        return False, f"{type(exc).__name__}: {exc}"
