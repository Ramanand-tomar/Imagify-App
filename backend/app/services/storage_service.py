from __future__ import annotations

import binascii
import logging
from typing import TYPE_CHECKING

import httpx
from imagekitio import ImageKit
from imagekitio.models.UploadFileRequestOptions import UploadFileRequestOptions

from app.config import settings

if TYPE_CHECKING:
    from imagekitio.models.UploadFileResponse import UploadFileResponse

logger = logging.getLogger("imagify.storage")

# Magic bytes for the file types we ship. Used by post-upload verification to
# detect any byte-level corruption between our process and ImageKit storage.
_MAGIC: dict[str, list[bytes]] = {
    "application/pdf": [b"%PDF-"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/webp": [b"RIFF"],  # RIFF...WEBP
    "application/zip": [b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"],
}


class StorageError(RuntimeError):
    """Raised when ImageKit upload / signing / fetch fails."""


def get_imagekit() -> ImageKit:
    """Initialize ImageKit SDK using environment variables."""
    return ImageKit(
        public_key=settings.IMAGEKIT_PUBLIC_KEY,
        private_key=settings.IMAGEKIT_PRIVATE_KEY,
        url_endpoint=settings.IMAGEKIT_URL_ENDPOINT,
    )


def _hex_preview(data: bytes, n: int = 16) -> str:
    """Hex-dump first ``n`` bytes for logs (e.g. ``25 50 44 46 2d 31 2e 34``)."""
    head = data[:n]
    return binascii.hexlify(head, sep=" ").decode("ascii") if head else "<empty>"


def _expected_magics(mime_type: str | None, filename: str) -> list[bytes]:
    """Return the list of known good magic-byte prefixes for a file. Empty
    list means "we don't know how to verify this type"."""
    mt = (mime_type or "").lower()
    if mt in _MAGIC:
        return _MAGIC[mt]
    # Fall back to extension sniffing for callers that don't pass MIME type.
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext == "pdf":
        return _MAGIC["application/pdf"]
    if ext == "png":
        return _MAGIC["image/png"]
    if ext in ("jpg", "jpeg"):
        return _MAGIC["image/jpeg"]
    if ext == "webp":
        return _MAGIC["image/webp"]
    if ext == "zip":
        return _MAGIC["application/zip"]
    return []


def _verify_uploaded_bytes(
    file_path: str,
    expected_bytes: bytes,
    *,
    mime_type: str | None,
    filename: str,
) -> None:
    """Round-trip-fetch the file we just uploaded and compare magic bytes
    against the original. Logs a loud warning if ImageKit served back
    something that doesn't match what we sent — this catches SDK encoding
    bugs and account-side processing surprises that would otherwise show
    up as "Can't open PDF file" on the client.

    Best-effort: never raises. Skipped if we can't sign the URL or fetch.
    """
    try:
        signed = get_signed_url(file_path, expire_seconds=120)
    except StorageError as exc:
        logger.warning("Verify skipped — could not sign %s: %s", file_path, exc)
        return

    try:
        # Identity encoding so we compare raw bytes, never a decoded view.
        with httpx.Client(timeout=30.0, follow_redirects=True) as c:
            resp = c.get(signed, headers={"Accept-Encoding": "identity"})
    except httpx.HTTPError as exc:
        logger.warning("Verify skipped — fetch failed for %s: %s", file_path, exc)
        return

    if resp.status_code != 200:
        logger.warning(
            "Verify skipped — ImageKit returned %s for verification fetch of %s",
            resp.status_code, file_path,
        )
        return

    served = resp.content
    served_size = len(served)
    expected_size = len(expected_bytes)
    served_head = _hex_preview(served)
    expected_head = _hex_preview(expected_bytes)

    magics = _expected_magics(mime_type, filename)
    matches_magic = any(served.startswith(m) for m in magics) if magics else None
    same_size = served_size == expected_size

    if same_size and (matches_magic is None or matches_magic):
        logger.info(
            "Verify OK file_path=%s size=%d head=%s",
            file_path, served_size, served_head,
        )
        return

    # Something is off — log loudly so it shows up in Render dashboard.
    logger.error(
        "Verify FAIL file_path=%s mime=%s\n"
        "  expected size=%d head=%s\n"
        "  served   size=%d head=%s\n"
        "  matches_magic=%s\n"
        "  This means ImageKit storage holds different bytes than we uploaded. "
        "Likely causes: imagekitio SDK base64-encoding bug, account "
        "processing on non-image files, or wrong file_path returned.",
        file_path, mime_type,
        expected_size, expected_head,
        served_size, served_head,
        matches_magic,
    )


def upload_file(
    file_bytes: bytes,
    filename: str,
    task_id: str | None = None,
    folder: str = "processed",
    *,
    mime_type: str | None = None,
    verify: bool = True,
) -> tuple[str, str, str]:
    """Uploads a file to ImageKit.

    Returns ``(file_id, file_path, url)``.

    When ``verify`` is True, immediately fetches the file back via a signed
    URL and logs a loud warning if magic bytes / size don't match the
    upload — this is the single most useful diagnostic for "file uploads
    fine but downloads as garbage" bugs.

    Raises ``StorageError`` if the upload itself fails or returns an unusable
    response. Verification failures are *logged but not raised* so that a
    flaky verification step never breaks an otherwise-working upload.
    """
    client = get_imagekit()

    target_folder = f"/imagify/{folder}"
    if task_id:
        target_folder = f"{target_folder}/{task_id}"

    logger.info(
        "Upload start: filename=%s size=%d mime=%s head=%s folder=%s",
        filename, len(file_bytes), mime_type, _hex_preview(file_bytes), target_folder,
    )

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

    if verify:
        _verify_uploaded_bytes(file_path, file_bytes, mime_type=mime_type, filename=filename)

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
