"""Document-scanner pipeline. Classical OpenCV operations only.

Pipeline: edge-detect corners → perspective correct → deskew → shadow removal →
binarize. Each step exposed independently so the API can do one at a time for
previews, and as ``full_scan_pipeline`` for one-shot processing.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import cv2
import numpy as np

from app.services.image_service import ImageServiceError

BinarizeMethod = Literal["otsu", "adaptive", "none"]


@dataclass
class ScanConfig:
    corners: list[tuple[float, float]] | None = None  # 4 (x, y) pairs in source pixels, TL, TR, BR, BL
    do_deskew: bool = True
    do_shadow_removal: bool = True
    binarize: BinarizeMethod = "adaptive"
    adaptive_block_size: int = 31
    adaptive_c: int = 10


# ---- edge detection ---------------------------------------------------------


def detect_document_edges(img: np.ndarray) -> list[tuple[float, float]]:
    """Return 4 corners (TL, TR, BR, BL) in source-image pixel coordinates.

    Falls back to full-image corners when no quad is detected.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(gray, 75, 200)
    edged = cv2.dilate(edged, np.ones((3, 3), np.uint8), iterations=1)

    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]

    for c in contours:
        area = cv2.contourArea(c)
        if area < 0.1 * (h * w):
            continue
        peri = cv2.arcLength(c, True)
        approx = cv2.approxPolyDP(c, 0.02 * peri, True)
        if len(approx) == 4:
            pts = approx.reshape(4, 2).astype(np.float32)
            return _order_corners(pts)

    # Fallback: slight inset of full image
    inset = 0.02
    return [
        (w * inset, h * inset),
        (w * (1 - inset), h * inset),
        (w * (1 - inset), h * (1 - inset)),
        (w * inset, h * (1 - inset)),
    ]


def _order_corners(pts: np.ndarray) -> list[tuple[float, float]]:
    """Order 4 points as TL, TR, BR, BL by sum / diff of coordinates."""
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    tl = pts[np.argmin(s)]
    br = pts[np.argmax(s)]
    tr = pts[np.argmin(d)]
    bl = pts[np.argmax(d)]
    return [tuple(tl.tolist()), tuple(tr.tolist()), tuple(br.tolist()), tuple(bl.tolist())]


# ---- perspective correction -------------------------------------------------


def correct_perspective(img: np.ndarray, corners: list[tuple[float, float]]) -> np.ndarray:
    if len(corners) != 4:
        raise ImageServiceError("Exactly 4 corners required")
    src = np.array(corners, dtype=np.float32)
    tl, tr, br, bl = src
    width_a = np.linalg.norm(br - bl)
    width_b = np.linalg.norm(tr - tl)
    height_a = np.linalg.norm(tr - br)
    height_b = np.linalg.norm(tl - bl)
    target_w = int(max(width_a, width_b))
    target_h = int(max(height_a, height_b))
    if target_w < 10 or target_h < 10:
        raise ImageServiceError("Corners define a degenerate region")

    dst = np.array(
        [[0, 0], [target_w - 1, 0], [target_w - 1, target_h - 1], [0, target_h - 1]],
        dtype=np.float32,
    )
    M = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(img, M, (target_w, target_h))


# ---- deskew -----------------------------------------------------------------


def deskew(img: np.ndarray) -> np.ndarray:
    """Rotate image to correct small skew (±15°) using Hough lines on edges."""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    lines = cv2.HoughLines(edges, 1, np.pi / 180, 200)

    if lines is None:
        return img

    angles: list[float] = []
    for line in lines[:100]:
        rho, theta = line[0]
        deg = (theta * 180.0 / np.pi) - 90.0
        # consider only near-horizontal lines
        if -15 <= deg <= 15:
            angles.append(deg)

    if not angles:
        return img

    angle = float(np.median(angles))
    h, w = img.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(img, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


# ---- shadow removal ---------------------------------------------------------


def remove_shadows(img: np.ndarray) -> np.ndarray:
    """Estimate background lighting per channel, divide it out. Brightens shadows."""
    channels = cv2.split(img)
    result = []
    for ch in channels:
        dilated = cv2.dilate(ch, np.ones((7, 7), np.uint8))
        bg = cv2.medianBlur(dilated, 21)
        diff = 255 - cv2.absdiff(ch, bg)
        normed = cv2.normalize(diff, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
        result.append(normed)
    return cv2.merge(result)


# ---- binarize ---------------------------------------------------------------


def binarize(
    img: np.ndarray,
    method: BinarizeMethod = "adaptive",
    block_size: int = 31,
    c: int = 10,
) -> np.ndarray:
    if method == "none":
        return img
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.ndim == 3 else img
    if method == "otsu":
        _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    elif method == "adaptive":
        if block_size % 2 == 0 or block_size < 3:
            raise ImageServiceError("block_size must be an odd integer >= 3")
        bw = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, block_size, c
        )
    else:
        raise ImageServiceError(f"Unknown binarization method: {method}")
    return cv2.cvtColor(bw, cv2.COLOR_GRAY2BGR)


# ---- full pipeline ---------------------------------------------------------


def full_scan_pipeline(img: np.ndarray, config: ScanConfig) -> np.ndarray:
    corners = config.corners or detect_document_edges(img)
    out = correct_perspective(img, corners)
    if config.do_deskew:
        out = deskew(out)
    if config.do_shadow_removal:
        out = remove_shadows(out)
    if config.binarize != "none":
        out = binarize(
            out,
            method=config.binarize,
            block_size=config.adaptive_block_size,
            c=config.adaptive_c,
        )
    return out
