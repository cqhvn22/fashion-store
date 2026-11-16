"""Resolve short follow-ups before retrieval; the LLM still writes the answer."""

import re


_SIZE_TOPIC = re.compile(r"size|kích cỡ|chiều cao|cân nặng|\bnặng\b|\bcao\b", re.IGNORECASE)
_MEASUREMENT = re.compile(
    r"\b\d(?:[.,]\d{1,2})?\s*m\b|\b\d\s*m\s*\d{1,2}\b|\b\d{2,3}\s*(?:kg|ký)\b|"
    r"\b(?:nặng|cao)\s*\d",
    re.IGNORECASE,
)


def size_followup(message: str, history: list[dict]) -> bool:
    """Recognize measurements supplied after an assistant asks for sizing details."""
    recent = history[-3:]
    return bool(_MEASUREMENT.search(message) and any(
        _SIZE_TOPIC.search(item.get("content", "")) for item in recent
    ))


def retrieval_query(message: str, *, sizing: bool) -> str:
    # A measurement by itself has poor semantic similarity to a size guide.
    return f"tư vấn chọn size chiều cao cân nặng {message}" if sizing else message


def catalog_count_question(message: str) -> bool:
    query = message.casefold()
    return bool(
        re.search(r"(?:bao nhiêu|có mấy|tổng số|số lượng)", query)
        and re.search(r"(?:sản phẩm|mặt hàng|mẫu hàng)", query)
    )
