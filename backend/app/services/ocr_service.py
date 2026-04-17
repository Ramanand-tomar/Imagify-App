"""OCR operations for images and PDFs."""
from __future__ import annotations

import io
from typing import List

import cv2
import numpy as np
import pytesseract
from pdf2image import convert_from_bytes
from PIL import Image


class OCRServiceError(ValueError):
    """User-facing OCR processing error."""


def preprocess_for_ocr(img: np.ndarray) -> np.ndarray:
    """
    Apply preprocessing to improve OCR accuracy:
    grayscale -> deskew -> Otsu binarize -> median denoise -> morphological closing
    """
    # 1. Grayscale
    if len(img.shape) == 3:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    else:
        gray = img

    # 2. Deskew (Alignment)
    # Use minAreaRect to find the orientation of the text blocks
    coords = np.column_stack(np.where(gray > 0))
    if coords.size > 0:
        # Find min area rectangle
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]
        
        # Adjust angle
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle
            
        (h, w) = gray.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        gray = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

    # 3. Otsu Binarize
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # 4. Median Denoise
    denoised = cv2.medianBlur(binary, 3)

    # 5. Morphological closing (fills small holes)
    kernel = np.ones((1, 1), np.uint8)
    closing = cv2.morphologyEx(denoised, cv2.MORPH_CLOSE, kernel)

    return closing


def extract_text(image_bytes: bytes, language: str = "eng") -> str:
    """Extract text from an image after preprocessing."""
    try:
        # Decode image
        arr = np.frombuffer(image_bytes, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        if img is None:
            # Fallback to PIL if cv2 fails
            try:
                pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
                img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
            except Exception as exc:
                raise OCRServiceError(f"Unsupported image format: {exc}") from exc

        # Preprocess
        processed = preprocess_for_ocr(img)

        # OCR
        text = pytesseract.image_to_string(processed, lang=language)
        return text.strip()
    except Exception as exc:
        if isinstance(exc, OCRServiceError):
            raise
        raise OCRServiceError(f"OCR processing failed: {exc}") from exc


def extract_text_from_pdf(pdf_bytes: bytes, language: str = "eng") -> str:
    """Convert PDF pages to images and extract text from each."""
    try:
        # Using 300 DPI for better accuracy
        images = convert_from_bytes(pdf_bytes, dpi=300)
        results = []
        for i, img in enumerate(images):
            # Convert PIL to CV2
            cv_img = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
            processed = preprocess_for_ocr(cv_img)
            text = pytesseract.image_to_string(processed, lang=language)
            
            page_header = f"--- Page {i+1} ---"
            results.append(f"{page_header}\n{text.strip()}")

        if not results:
            return ""
            
        return "\n\n".join(results)
    except Exception as exc:
        raise OCRServiceError(f"PDF OCR failed: {exc}") from exc


def get_supported_languages() -> List[str]:
    """Return list of supported Tesseract languages."""
    try:
        return pytesseract.get_languages(config="")
    except Exception:
        # Tesseract might not be initialized or accessible in this environment
        return ["eng"]
