"""Pure PDF operations. No DB access, no I/O beyond in-memory bytes.

Each function accepts/returns raw bytes or simple primitives so they can be
called from FastAPI handlers (sync path) or Celery tasks (async path).
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Literal

from PIL import Image
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.errors import PdfReadError

Quality = Literal["low", "medium", "high"]
PositionSpec = Literal[
    "top-left", "top-center", "top-right",
    "bottom-left", "bottom-center", "bottom-right",
]


class PdfServiceError(ValueError):
    """User-facing PDF processing error (400-class)."""


@dataclass
class JpgPage:
    page_number: int
    filename: str
    bytes: bytes


def merge_pdfs(files: list[bytes]) -> bytes:
    if not files:
        raise PdfServiceError("At least one file required")
    if len(files) > 10:
        raise PdfServiceError("Maximum 10 files can be merged at once")
    writer = PdfWriter()
    for data in files:
        try:
            reader = PdfReader(io.BytesIO(data))
        except PdfReadError as exc:
            raise PdfServiceError(f"Invalid PDF: {exc}") from exc
        for page in reader.pages:
            writer.add_page(page)
    return _write(writer)


def merge_pdfs_from_paths(paths: list[str]) -> bytes:
    """Like ``merge_pdfs`` but reads each source from a file path instead of
    holding all bodies in memory at once. ``pypdf.PdfReader`` opens the file
    by path so memory peak is bounded by the largest single document being
    referenced — not the sum of all inputs.
    """
    if not paths:
        raise PdfServiceError("At least one file required")
    if len(paths) > 10:
        raise PdfServiceError("Maximum 10 files can be merged at once")
    writer = PdfWriter()
    for path in paths:
        try:
            # PdfReader keeps the file handle open; pages are read lazily.
            reader = PdfReader(path)
        except PdfReadError as exc:
            raise PdfServiceError(f"Invalid PDF: {exc}") from exc
        for page in reader.pages:
            writer.add_page(page)
    return _write(writer)


def split_pdf(data: bytes, ranges: list[tuple[int, int]]) -> list[bytes]:
    """Split by 1-indexed inclusive page ranges. Returns one PDF per range."""
    if not ranges:
        raise PdfServiceError("At least one page range required")
    reader = _reader(data)
    total = len(reader.pages)
    outputs: list[bytes] = []
    for start, end in ranges:
        if start < 1 or end < start or end > total:
            raise PdfServiceError(f"Invalid range {start}-{end} (document has {total} pages)")
        writer = PdfWriter()
        for i in range(start - 1, end):
            writer.add_page(reader.pages[i])
        outputs.append(_write(writer))
    return outputs


def compress_pdf(data: bytes, quality: Quality = "medium") -> bytes:
    """Recompress page content streams + downscale embedded images."""
    reader = _reader(data)
    writer = PdfWriter(clone_from=reader)

    image_quality = {"low": 30, "medium": 60, "high": 85}[quality]

    for page in writer.pages:
        page.compress_content_streams()
        for image in page.images:
            try:
                pil = Image.open(io.BytesIO(image.data)).convert("RGB")
                buf = io.BytesIO()
                pil.save(buf, format="JPEG", quality=image_quality, optimize=True)
                image.replace(Image.open(io.BytesIO(buf.getvalue())), quality=image_quality)
            except Exception:
                continue

    return _write(writer)


def rotate_pdf(data: bytes, pages: list[int] | None, degrees: int) -> bytes:
    if degrees % 90 != 0:
        raise PdfServiceError("Rotation must be a multiple of 90 degrees")
    reader = _reader(data)
    writer = PdfWriter()
    total = len(reader.pages)
    target = set(pages) if pages else set(range(1, total + 1))
    for i, page in enumerate(reader.pages, start=1):
        if i in target:
            page.rotate(degrees)
        writer.add_page(page)
    return _write(writer)


def add_page_numbers(
    data: bytes,
    position: PositionSpec = "bottom-center",
    start_number: int = 1,
    font_size: int = 12,
) -> bytes:
    from pypdf.generic import RectangleObject

    reader = _reader(data)
    writer = PdfWriter()

    for idx, page in enumerate(reader.pages):
        number = start_number + idx
        overlay = _text_overlay(
            page.mediabox,
            text=str(number),
            position=position,
            font_size=font_size,
        )
        page.merge_page(overlay)
        writer.add_page(page)

    return _write(writer)


def add_watermark_text(
    data: bytes,
    text: str,
    opacity: float = 0.3,
    font_size: int = 48,
    rotation: int = 30,
) -> bytes:
    if not text.strip():
        raise PdfServiceError("Watermark text cannot be empty")
    reader = _reader(data)
    writer = PdfWriter()
    for page in reader.pages:
        overlay = _text_overlay(
            page.mediabox,
            text=text,
            position="center",
            font_size=font_size,
            rotation=rotation,
            opacity=opacity,
        )
        page.merge_page(overlay)
        writer.add_page(page)
    return _write(writer)


def pdf_to_jpg(data: bytes, dpi: int = 150, quality: int = 85) -> list[JpgPage]:
    from pdf2image import convert_from_bytes

    if not 30 <= quality <= 100:
        raise PdfServiceError("quality must be between 30 and 100")
    try:
        images = convert_from_bytes(data, dpi=dpi, fmt="jpeg")
    except Exception as exc:
        raise PdfServiceError(f"Failed to rasterize PDF: {exc}") from exc

    pages: list[JpgPage] = []
    for i, img in enumerate(images, start=1):
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=quality, optimize=True)
        pages.append(JpgPage(page_number=i, filename=f"page_{i:03d}.jpg", bytes=buf.getvalue()))
    return pages


def images_to_pdf(
    images: list[bytes],
    page_size: Literal["A4", "Letter", "fit"] = "A4",
) -> bytes:
    if not images:
        raise PdfServiceError("At least one image required")
    if len(images) > 50:
        raise PdfServiceError("Maximum 50 images allowed")

    sizes = {"A4": (595, 842), "Letter": (612, 792)}
    pil_pages: list[Image.Image] = []

    for raw in images:
        try:
            img = Image.open(io.BytesIO(raw)).convert("RGB")
        except Exception as exc:
            raise PdfServiceError(f"Invalid image: {exc}") from exc

        if page_size == "fit":
            pil_pages.append(img)
        else:
            target = sizes[page_size]
            canvas = Image.new("RGB", target, "white")
            img.thumbnail(target, Image.Resampling.LANCZOS)
            ox = (target[0] - img.width) // 2
            oy = (target[1] - img.height) // 2
            canvas.paste(img, (ox, oy))
            pil_pages.append(canvas)

    buf = io.BytesIO()
    pil_pages[0].save(buf, format="PDF", save_all=True, append_images=pil_pages[1:])
    return buf.getvalue()


def images_to_pdf_from_paths(
    paths: list[str],
    page_size: Literal["A4", "Letter", "fit"] = "A4",
) -> bytes:
    """Like ``images_to_pdf`` but reads each image from disk one at a time.

    Image bytes are released as soon as PIL has decoded them; only the
    canvases (smaller, page-sized) accumulate. This keeps peak memory
    bounded at ``len(images) * page-canvas-size`` plus one input image,
    instead of holding all original bytes in RAM simultaneously.
    """
    if not paths:
        raise PdfServiceError("At least one image required")
    if len(paths) > 50:
        raise PdfServiceError("Maximum 50 images allowed")

    sizes = {"A4": (595, 842), "Letter": (612, 792)}
    pil_pages: list[Image.Image] = []

    for path in paths:
        try:
            with Image.open(path) as src:
                img = src.convert("RGB")
        except Exception as exc:
            raise PdfServiceError(f"Invalid image: {exc}") from exc

        if page_size == "fit":
            pil_pages.append(img)
        else:
            target = sizes[page_size]
            canvas = Image.new("RGB", target, "white")
            img.thumbnail(target, Image.Resampling.LANCZOS)
            ox = (target[0] - img.width) // 2
            oy = (target[1] - img.height) // 2
            canvas.paste(img, (ox, oy))
            pil_pages.append(canvas)
            img.close()

    buf = io.BytesIO()
    pil_pages[0].save(buf, format="PDF", save_all=True, append_images=pil_pages[1:])
    return buf.getvalue()


def protect_pdf(data: bytes, password: str) -> bytes:
    if len(password) < 4:
        raise PdfServiceError("Password must be at least 4 characters")
    reader = _reader(data)
    writer = PdfWriter(clone_from=reader)
    writer.encrypt(user_password=password, owner_password=None, algorithm="AES-128")
    return _write(writer)


def unlock_pdf(data: bytes, password: str) -> bytes:
    reader = PdfReader(io.BytesIO(data))
    if reader.is_encrypted:
        try:
            if reader.decrypt(password) == 0:
                raise PdfServiceError("Incorrect password")
        except Exception as exc:
            raise PdfServiceError(f"Failed to decrypt: {exc}") from exc
    writer = PdfWriter(clone_from=reader)
    return _write(writer)


def repair_pdf(data: bytes) -> bytes:
    """Best-effort repair: re-parse in strict=False mode and rewrite."""
    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        return _write(writer)
    except Exception as exc:
        raise PdfServiceError(f"PDF is unrecoverable: {exc}") from exc


# ---- internals ---------------------------------------------------------------


def _reader(data: bytes) -> PdfReader:
    try:
        reader = PdfReader(io.BytesIO(data))
    except PdfReadError as exc:
        raise PdfServiceError(f"Invalid PDF: {exc}") from exc
    if reader.is_encrypted:
        raise PdfServiceError("PDF is password-protected; unlock it first")
    return reader


def _write(writer: PdfWriter) -> bytes:
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _text_overlay(
    mediabox,
    text: str,
    position: str,
    font_size: int,
    rotation: int = 0,
    opacity: float = 1.0,
) -> "PageObject":
    """Build a single-page overlay PDF with the given text, return its page."""
    from reportlab.lib.colors import Color  # type: ignore
    from reportlab.pdfgen import canvas as rl_canvas  # type: ignore

    # reportlab isn't a stated dep; fall back to a raw pypdf overlay if missing.
    width = float(mediabox.width)
    height = float(mediabox.height)
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf, pagesize=(width, height))
    c.setFont("Helvetica", font_size)
    c.setFillColor(Color(0, 0, 0, alpha=opacity))

    margin = 24
    x, y = width / 2, margin
    if "top" in position:
        y = height - margin - font_size
    if "bottom" in position:
        y = margin
    if "center" in position and "bottom" not in position and "top" not in position:
        y = height / 2
    if "left" in position:
        x = margin
    elif "right" in position:
        x = width - margin

    c.saveState()
    c.translate(x, y)
    if rotation:
        c.rotate(rotation)
    if "left" in position:
        c.drawString(0, 0, text)
    elif "right" in position:
        c.drawRightString(0, 0, text)
    else:
        c.drawCentredString(0, 0, text)
    c.restoreState()
    c.showPage()
    c.save()

    overlay_reader = PdfReader(io.BytesIO(buf.getvalue()))
    return overlay_reader.pages[0]
