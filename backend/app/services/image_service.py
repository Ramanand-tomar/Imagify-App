"""Pure image operations: classical DIP enhancements + format/quality utilities.

Functions accept/return bytes where practical so they can be called from FastAPI
handlers directly or from Celery workers.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Literal

import logging
import cv2
import numpy as np
from PIL import Image

logger = logging.getLogger("imagify.image")

FilterType = Literal["median", "gaussian", "bilateral"]
EdgeOperator = Literal["sobel", "prewitt", "canny"]
TargetFormat = Literal["jpeg", "png", "webp", "bmp", "tiff"]

_MIME = {
    "jpeg": "image/jpeg",
    "png": "image/png",
    "webp": "image/webp",
    "bmp": "image/bmp",
    "tiff": "image/tiff",
}


class ImageServiceError(ValueError):
    """User-facing image processing error (400-class)."""


@dataclass
class EncodedImage:
    data: bytes
    mime_type: str
    width: int
    height: int


# ---- decoding / encoding ----------------------------------------------------


def decode_bgr(data: bytes) -> np.ndarray:
    """Decode arbitrary image bytes to a BGR numpy array."""
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        try:
            pil = Image.open(io.BytesIO(data)).convert("RGB")
        except Exception as exc:
            raise ImageServiceError(f"Unsupported image: {exc}") from exc
        img = cv2.cvtColor(np.array(pil), cv2.COLOR_RGB2BGR)
    return img


def encode_png(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise ImageServiceError("Failed to encode PNG")
    return buf.tobytes()


def encode_jpeg(img: np.ndarray, quality: int = 90) -> bytes:
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, int(quality)])
    if not ok:
        raise ImageServiceError("Failed to encode JPEG")
    return buf.tobytes()


# ---- classical DIP operations (return numpy BGR arrays) ---------------------


def apply_clahe(img: np.ndarray, clip_limit: float = 2.0, tile_size: int = 8) -> np.ndarray:
    if clip_limit <= 0 or tile_size < 1:
        raise ImageServiceError("clip_limit must be > 0 and tile_size >= 1")
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_size, tile_size))
    l_eq = clahe.apply(l)
    return cv2.cvtColor(cv2.merge([l_eq, a, b]), cv2.COLOR_LAB2BGR)


def stretch_contrast(img: np.ndarray, contrast_pct: float = 0.0, brightness: int = 0) -> np.ndarray:
    """contrast_pct in [-100, 100]; brightness in [-100, 100]."""
    if not -100 <= contrast_pct <= 100:
        raise ImageServiceError("contrast_pct must be in [-100, 100]")
    if not -100 <= brightness <= 100:
        raise ImageServiceError("brightness must be in [-100, 100]")
    alpha = 1.0 + (contrast_pct / 100.0)
    beta = brightness
    return cv2.convertScaleAbs(img, alpha=alpha, beta=beta)


def unsharp_mask(img: np.ndarray, strength: float = 1.0, radius: float = 1.5) -> np.ndarray:
    if strength < 0 or radius <= 0:
        raise ImageServiceError("strength must be >= 0 and radius > 0")
    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=radius, sigmaY=radius)
    sharpened = cv2.addWeighted(img, 1.0 + strength, blurred, -strength, 0)
    return np.clip(sharpened, 0, 255).astype(np.uint8)


def reduce_noise(
    img: np.ndarray,
    filter_type: FilterType = "median",
    kernel_size: int = 3,
) -> np.ndarray:
    if kernel_size < 1 or kernel_size % 2 == 0:
        raise ImageServiceError("kernel_size must be an odd integer >= 1")
    if filter_type == "median":
        return cv2.medianBlur(img, kernel_size)
    if filter_type == "gaussian":
        return cv2.GaussianBlur(img, (kernel_size, kernel_size), 0)
    if filter_type == "bilateral":
        return cv2.bilateralFilter(img, d=kernel_size, sigmaColor=75, sigmaSpace=75)
    raise ImageServiceError(f"Unknown filter_type: {filter_type}")


def detect_edges(
    img: np.ndarray,
    operator: EdgeOperator = "canny",
    low_thresh: int = 100,
    high_thresh: int = 200,
) -> np.ndarray:
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    if operator == "canny":
        if not 0 <= low_thresh < high_thresh <= 500:
            raise ImageServiceError("thresholds must satisfy 0 <= low < high <= 500")
        edges = cv2.Canny(gray, low_thresh, high_thresh)
    elif operator == "sobel":
        gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        mag = cv2.magnitude(gx, gy)
        edges = np.clip(mag, 0, 255).astype(np.uint8)
    elif operator == "prewitt":
        kx = np.array([[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]], dtype=np.float32)
        ky = np.array([[-1, -1, -1], [0, 0, 0], [1, 1, 1]], dtype=np.float32)
        gx = cv2.filter2D(gray, cv2.CV_64F, kx)
        gy = cv2.filter2D(gray, cv2.CV_64F, ky)
        mag = cv2.magnitude(gx, gy)
        edges = np.clip(mag, 0, 255).astype(np.uint8)
    else:
        raise ImageServiceError(f"Unknown edge operator: {operator}")

    return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)


# ---- utility operations (accept/return bytes) -------------------------------


def convert_format(
    data: bytes,
    target_format: TargetFormat,
    quality: int = 90,
) -> EncodedImage:
    if target_format not in _MIME:
        raise ImageServiceError(f"Unsupported target format: {target_format}")
    if not 1 <= quality <= 100:
        raise ImageServiceError("quality must be in [1, 100]")

    pil = _pil_from_bytes(data)
    out = io.BytesIO()
    save_kwargs: dict = {}

    if target_format == "jpeg":
        pil = pil.convert("RGB")
        save_kwargs = {"quality": quality, "optimize": True}
        fmt = "JPEG"
    elif target_format == "png":
        fmt = "PNG"
        save_kwargs = {"optimize": True}
    elif target_format == "webp":
        save_kwargs = {"quality": quality}
        fmt = "WEBP"
    elif target_format == "bmp":
        pil = pil.convert("RGB")
        fmt = "BMP"
    else:  # tiff
        fmt = "TIFF"

    pil.save(out, format=fmt, **save_kwargs)
    encoded = out.getvalue()
    return EncodedImage(data=encoded, mime_type=_MIME[target_format], width=pil.width, height=pil.height)


def compress_image(data: bytes, quality: int = 75) -> EncodedImage:
    if not 1 <= quality <= 100:
        raise ImageServiceError("quality must be in [1, 100]")
    pil = _pil_from_bytes(data).convert("RGB")
    out = io.BytesIO()
    pil.save(out, format="JPEG", quality=quality, optimize=True)
    return EncodedImage(data=out.getvalue(), mime_type="image/jpeg", width=pil.width, height=pil.height)


def resize_image(
    data: bytes,
    width: int | None,
    height: int | None,
    maintain_ratio: bool = True,
) -> EncodedImage:
    if not width and not height:
        raise ImageServiceError("Provide at least one of width or height")
    if width and (width < 1 or width > 10000):
        raise ImageServiceError("width out of range")
    if height and (height < 1 or height > 10000):
        raise ImageServiceError("height out of range")

    pil = _pil_from_bytes(data)
    ow, oh = pil.size

    if maintain_ratio:
        if width and not height:
            scale = width / ow
            target = (width, max(1, int(oh * scale)))
        elif height and not width:
            scale = height / oh
            target = (max(1, int(ow * scale)), height)
        else:
            scale = min(width / ow, height / oh)  # type: ignore[operator]
            target = (max(1, int(ow * scale)), max(1, int(oh * scale)))
    else:
        target = (width or ow, height or oh)

    resized = pil.resize(target, Image.Resampling.LANCZOS)
    out = io.BytesIO()
    fmt = pil.format or "PNG"
    mime_key = fmt.lower()
    resized.save(out, format=fmt)
    return EncodedImage(
        data=out.getvalue(),
        mime_type=_MIME.get(mime_key, f"image/{mime_key.lower()}"),
        width=resized.width,
        height=resized.height,
    )


def generate_histogram_image(data: bytes) -> EncodedImage:
    """Calculates and returns a visualization of the color histogram."""
    img = decode_bgr(data)
    # Simple histogram plot using OpenCV
    hist_img = np.zeros((300, 256, 3), dtype=np.uint8) + 255
    colors = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]  # BGR
    for i, col in enumerate(colors):
        hist = cv2.calcHist([img], [i], None, [256], [0, 256])
        cv2.normalize(hist, hist, 0, 200, cv2.NORM_MINMAX)
        points = []
        for x in range(256):
            y = 250 - int(hist[x])
            points.append((x, y))
        for j in range(len(points) - 1):
            cv2.line(hist_img, points[j], points[j + 1], col, 2)

    return EncodedImage(data=encode_png(hist_img), mime_type="image/png", width=256, height=300)


def denoise_ai(
    img: np.ndarray,
    h: int = 10,
    template_window_size: int = 7,
    search_window_size: int = 21,
) -> np.ndarray:
    """Non-Local Means Denoising. Specified in DIP Unit III."""
    if not 1 <= h <= 20:
        raise ImageServiceError("h (filter strength) must be in [1, 20]")

    try:
        # For colored images
        return cv2.fastNlMeansDenoisingColored(
            img,
            None,
            h,
            h,
            template_window_size,
            search_window_size,
        )
    except Exception as exc:
        # Fallback to a robust classical filter
        logger.warning("AI Denoise failed, falling back to median: %s", exc)
        return cv2.medianBlur(img, 5)


def deblur_wiener(
    img: np.ndarray,
    blur_type: Literal["motion", "defocus"] = "motion",
    kernel_size: int = 15,
    noise_power: float = 0.01,
) -> np.ndarray:
    """Deblurring using Wiener Filter (Frequency Domain Restoration). DIP Unit III."""
    if kernel_size < 3:
        raise ImageServiceError("kernel_size must be >= 3")
    if not 0 < noise_power <= 1.0:
        raise ImageServiceError("noise_power must be in (0, 1.0]")

    # Convert to float and work on each channel or grayscale
    channels = cv2.split(img.astype(np.float32))
    restored_channels = []

    # Create Kernel (PSF)
    size = kernel_size
    if blur_type == "motion":
        kernel = np.zeros((size, size))
        kernel[int((size - 1) / 2), :] = np.ones(size)
        kernel /= size
    else:  # defocus
        kernel = np.zeros((size, size), dtype=np.uint8)
        cv2.circle(kernel, (size // 2, size // 2), size // 2, 255, -1)
        kernel = kernel.astype(np.float32) / np.sum(kernel)

    for ch in channels:
        # Wiener implementation in frequency domain
        dummy = np.fft.fft2(ch)
        psf = np.fft.fft2(kernel, s=ch.shape)
        # Wiener formula: G(u,v) = [H*(u,v) / (|H(u,v)|^2 + K)] * F(u,v)
        # where K is noise-to-signal ratio
        psf_conj = np.conj(psf)
        wiener_kernel = psf_conj / (np.abs(psf) ** 2 + noise_power)
        restored = np.fft.ifft2(dummy * wiener_kernel)
        restored = np.abs(restored)
        restored_channels.append(np.clip(restored, 0, 255).astype(np.uint8))

    return cv2.merge(restored_channels)


def homomorphic_filter(
    img: np.ndarray,
    gamma_low: float = 0.5,
    gamma_high: float = 2.0,
    cutoff: float = 30.0,
) -> np.ndarray:
    """Frequency domain filtering to normalize illumination and enhance contrast. DIP Unit III."""
    if gamma_low < 0 or gamma_high < 0 or cutoff <= 0:
        raise ImageServiceError("gamma values >= 0 and cutoff > 0 required")

    # Work on L channel of LAB for illumination
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # 1. Log transform
    l_log = np.log1p(l.astype(np.float32))
    
    # 2. FFT
    l_fft = np.fft.fft2(l_log)
    l_fft_shift = np.fft.fftshift(l_fft)
    
    # 3. High-pass Gaussian Filter
    rows, cols = l.shape
    m, n = rows // 2, cols // 2
    y, x = np.ogrid[-m : rows - m, -n : cols - n]
    d2 = x * x + y * y
    # H(u,v) = (rh - rl) * [1 - exp(-c * d2 / d0^2)] + rl
    # We use a simpler version: 1 - exp(-d^2 / 2*sigma^2)
    h_uv = (gamma_high - gamma_low) * (1 - np.exp(-d2 / (2 * (cutoff**2)))) + gamma_low
    
    # Apply filter
    l_filtered = l_fft_shift * h_uv
    
    # 4. IFFT
    l_ifft_shift = np.fft.ifftshift(l_filtered)
    l_ifft = np.fft.ifft2(l_ifft_shift)
    
    # 5. Exp transform
    l_exp = np.expm1(np.abs(l_ifft))
    
    l_final = np.clip(l_exp, 0, 255).astype(np.uint8)
    return cv2.cvtColor(cv2.merge([l_final, a, b]), cv2.COLOR_LAB2BGR)


# ---- internals --------------------------------------------------------------


def _pil_from_bytes(data: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(data))
    except Exception as exc:
        raise ImageServiceError(f"Invalid image: {exc}") from exc
