"""Pure parser for page selectors used by /pdf/rotate (and similar).

Lives in services/ (not api/) so it has no FastAPI dependency and can be
unit-tested in isolation. The contract is locked by tests/test_pdf_page_selector.py.
"""
from __future__ import annotations


def parse_page_selector(raw: str) -> list[int]:
    """Parse a page selector like ``'1,3,5-7'`` into a flat 1-indexed list.

    Accepts both bare integers and inclusive ``a-b`` ranges, comma-separated.
    Order is preserved. Duplicate pages are silently de-duplicated to keep
    rotate-style operations idempotent.

    Raises ``ValueError`` for any malformed input.
    """
    pages: list[int] = []
    seen: set[int] = set()
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a_raw, b_raw = part.split("-", 1)
            try:
                a, b = int(a_raw.strip()), int(b_raw.strip())
            except ValueError as exc:
                raise ValueError(f"non-integer in range '{part}'") from exc
            if a < 1 or b < a:
                raise ValueError(f"invalid range '{part}'")
            for n in range(a, b + 1):
                if n not in seen:
                    seen.add(n)
                    pages.append(n)
        else:
            try:
                n = int(part)
            except ValueError as exc:
                raise ValueError(f"non-integer page '{part}'") from exc
            if n < 1:
                raise ValueError(f"page must be >= 1: '{part}'")
            if n not in seen:
                seen.add(n)
                pages.append(n)
    if not pages:
        raise ValueError("no pages selected")
    return pages
