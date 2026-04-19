"""Locks the /pdf/rotate page-selector contract.

The frontend (frontend/app/pdf/rotate.tsx) advertises the placeholder
``"e.g. 1,3,5-7 — leave blank for all"``. The backend must accept that
exact format. These tests prevent regression on either side.
"""
from __future__ import annotations

import os
import sys

import pytest

# Allow running `pytest` from the backend/ directory without installing the pkg.
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

from app.services.page_selector import parse_page_selector  # noqa: E402


class TestParsePageSelector:
    def test_single_int(self):
        assert parse_page_selector("3") == [3]

    def test_comma_separated(self):
        assert parse_page_selector("1,3,5") == [1, 3, 5]

    def test_simple_range(self):
        assert parse_page_selector("5-7") == [5, 6, 7]

    def test_mixed_frontend_placeholder(self):
        # Exact format the rotate screen suggests.
        assert parse_page_selector("1,3,5-7") == [1, 3, 5, 6, 7]

    def test_whitespace_is_tolerated(self):
        assert parse_page_selector(" 1 , 3 , 5 - 7 ") == [1, 3, 5, 6, 7]

    def test_dedupes(self):
        assert parse_page_selector("1,1,2-3,3") == [1, 2, 3]

    def test_empty_segments_skipped(self):
        assert parse_page_selector("1,,2") == [1, 2]

    def test_rejects_non_integer(self):
        with pytest.raises(ValueError):
            parse_page_selector("abc")

    def test_rejects_inverted_range(self):
        with pytest.raises(ValueError):
            parse_page_selector("5-3")

    def test_rejects_zero_or_negative(self):
        with pytest.raises(ValueError):
            parse_page_selector("0")
        with pytest.raises(ValueError):
            parse_page_selector("-1")

    def test_rejects_empty(self):
        with pytest.raises(ValueError):
            parse_page_selector("")
        with pytest.raises(ValueError):
            parse_page_selector(",,,")
