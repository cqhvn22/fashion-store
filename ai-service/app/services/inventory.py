"""Real-time inventory and volatile catalog data querying tool for AI assistant.
Dynamically constructs and executes SQL queries against PostgreSQL (fashion_catalog).
"""

from __future__ import annotations

import logging
import os
import re
from uuid import UUID
import psycopg
from psycopg.rows import dict_row

logger = logging.getLogger(__name__)

CATALOG_DB_URL = os.environ.get(
    "CATALOG_DB_URL",
    "postgresql://fashion:change-me@postgres:5432/fashion_catalog"
)
AI_DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://fashion:change-me@postgres:5432/fashion_ai"
)


def is_inventory_inquiry(text: str) -> bool:
    """Detect if user is inquiring about stock, availability, or variant quantity."""
    q = text.lower()
    patterns = [
        r"\bcòn\s+(?:bao\s+nhiêu|mấy|nhiều|hàng|không|k|chiếc|cái|áo|quần|size|màu)\b",
        r"\b(?:tồn\s+kho|kiểm\s+tra\s+kho|check\s+kho|hết\s+hàng|còn\s+hàng|có\s+sẵn)\b",
        r"\b(?:số\s+lượng\s+còn|trong\s+kho\s+còn|kho\s+còn)\b",
        r"\b(?:sp\d+|sản\s+phẩm\s+\d+|mẫu\s+\d+)\s+còn\b",
        r"\bcòn\s+(?:size|cỡ|màu)\s+[a-z0-9]+\b",
    ]
    return any(re.search(pat, q) for pat in patterns) or any(
        term in q for term in (
            "còn bao nhiêu", "tồn kho", "còn hàng", "còn không", "hết hàng",
            "còn mấy cái", "còn mấy chiếc", "trong kho còn", "kho còn bao nhiêu",
            "còn size", "còn màu"
        )
    )


def extract_product_ref_index(text: str) -> int | None:
    """Extract SP index from text like 'sp1', 'sp 2', 'sản phẩm 1', 'mẫu 1' (0-indexed)."""
    q = text.lower()
    m = re.search(r"\b(?:sp|sản\s*phẩm|mẫu|cái\s*thứ|áo\s*thứ)\s*(\d+)\b", q)
    if m:
        try:
            return int(m.group(1)) - 1
        except ValueError:
            pass
    return None


def resolve_product_for_inventory(
    question: str,
    conversation_id: UUID | None,
    history: list[dict],
) -> dict | None:
    """Resolve which product the user is asking about:
    1. By citation / index (SP1, SP2...) in conversation suggestions
    2. By product code / title mentioned in question
    3. Fallback to latest suggested product in conversation
    """
    ref_idx = extract_product_ref_index(question)

    # 1. Try resolving via conversation history in fashion_ai
    if conversation_id is not None:
        try:
            with psycopg.connect(AI_DB_URL, row_factory=dict_row) as conn:
                with conn.cursor() as cur:
                    # Check chat_message_product_suggestions of latest assistant message
                    cur.execute(
                        """
                        SELECT s.product_id, s.position
                        FROM chat_message_product_suggestions s
                        JOIN chat_messages m ON m.id = s.message_id
                        WHERE m.conversation_id = %s AND m.role = 'ASSISTANT'
                        ORDER BY m.created_at DESC, s.position ASC
                        LIMIT 5
                        """,
                        (conversation_id,),
                    )
                    suggestions = cur.fetchall()
                    if suggestions:
                        target_id = None
                        if ref_idx is not None and 0 <= ref_idx < len(suggestions):
                            target_id = suggestions[ref_idx]["product_id"]
                        elif ref_idx is None:
                            target_id = suggestions[0]["product_id"]

                        if target_id:
                            prod = fetch_product_by_id(target_id)
                            if prod:
                                return prod
        except Exception as e:
            logger.warning("Error resolving product from conversation suggestions: %s", e)

    # 2. Try matching code or name from the question directly
    # e.g. L.3.7795, 7795, Áo Nỉ Basic
    code_match = re.search(r"([a-zA-Z]\.\d+\.\d+)", question)
    if code_match:
        prod = search_catalog_product(code_match.group(1))
        if prod:
            return prod

    num_match = re.search(r"\b(\d{4,5})\b", question)
    if num_match:
        prod = search_catalog_product(num_match.group(1))
        if prod:
            return prod

    # Try matching common product keywords in question
    clean_q = re.sub(r"\b(còn|bao|nhiêu|hàng|không|kho|tồn|size|màu|cho|tôi|hỏi|xem|kiểm|tra|giá)\b", "", question, flags=re.I).strip()
    if len(clean_q) >= 4:
        prod = search_catalog_product(clean_q)
        if prod:
            return prod

    # 3. Fallback: Check last assistant message text in history for product names
    if history:
        for msg in reversed(history):
            if msg.get("role") in ("assistant", "model"):
                content = msg.get("content", "")
                bold_names = re.findall(r"\*\*([^*]+)\*\*", content)
                for b_name in bold_names:
                    if any(k in b_name.lower() for k in ("áo", "quần", "khoác", "polo", "sơ mi", "dép", "giày")):
                        prod = search_catalog_product(b_name)
                        if prod:
                            return prod

    return None


def fetch_product_by_id(product_id: UUID | str) -> dict | None:
    """Fetch product metadata from fashion_catalog."""
    try:
        with psycopg.connect(CATALOG_DB_URL, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, name, slug, status, original_price
                    FROM products
                    WHERE id = %s
                    """,
                    (product_id,),
                )
                return cur.fetchone()
    except Exception as e:
        logger.warning("Error fetching product by id %s: %s", product_id, e)
        return None


def search_catalog_product(keyword: str) -> dict | None:
    """Search products in fashion_catalog by name or slug keyword."""
    try:
        with psycopg.connect(CATALOG_DB_URL, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                pattern = f"%{keyword.strip()}%"
                cur.execute(
                    """
                    SELECT id, name, slug, status, original_price
                    FROM products
                    WHERE (name ILIKE %s OR slug ILIKE %s)
                    ORDER BY CASE WHEN name ILIKE %s THEN 0 ELSE 1 END, created_at DESC
                    LIMIT 1
                    """,
                    (pattern, pattern, pattern),
                )
                return cur.fetchone()
    except Exception as e:
        logger.warning("Error searching catalog product '%s': %s", keyword, e)
        return None


def extract_requested_size(text: str) -> str | None:
    m = re.search(r"\b(?:size|cỡ)\s*(4XL|3XL|2XL|XL|XS|S|M|L|2[8-9]|3[0-9]|4[0-5])\b", text, re.I)
    return m.group(1).upper() if m else None


def extract_requested_color(text: str) -> str | None:
    m = re.search(r"\bmàu\s+([a-zA-ZÀ-ỹ\s]+?)(?:\s+(?:còn|hết|size|không|\?|$)|$)", text, re.I)
    if m:
        c = m.group(1).strip()
        if c.lower() not in ("gì", "nào", "sắc"):
            return c
    return None


def query_live_inventory(
    product: dict,
    requested_size: str | None = None,
    requested_color: str | None = None,
) -> dict:
    """Execute dynamic SQL query to retrieve live variant stock for a product."""
    product_id = product["id"]

    sql_query = """
    SELECT
        p.id AS product_id,
        p.name AS product_name,
        p.slug,
        p.status,
        p.original_price,
        v.id AS variant_id,
        v.sku,
        v.color,
        v.size,
        v.price,
        v.stock_quantity,
        v.reserved_quantity,
        (v.stock_quantity - v.reserved_quantity) AS available_stock,
        v.image_url,
        v.is_active
    FROM products p
    JOIN product_variants v ON v.product_id = p.id
    WHERE p.id = %s
      AND v.is_active = true
    ORDER BY v.color, v.size;
    """

    rows = []
    try:
        with psycopg.connect(CATALOG_DB_URL, row_factory=dict_row) as conn:
            with conn.cursor() as cur:
                cur.execute(sql_query, (product_id,))
                rows = cur.fetchall()
    except Exception as e:
        logger.exception("Database query failed for inventory: %s", e)
        return {
            "error": str(e),
            "sql": sql_query.strip(),
            "product": product,
            "total_stock": 0,
            "variants": [],
        }

    total_stock = sum(max(0, r["available_stock"]) for r in rows)
    min_price = min((int(r["price"]) for r in rows), default=0)
    image_url = next((r["image_url"] for r in rows if r.get("image_url")), None)

    # Group by color and size
    by_color: dict[str, dict[str, int]] = {}
    for r in rows:
        color = r["color"] or "Mặc định"
        size = r["size"] or "Tiêu chuẩn"
        stock = max(0, r["available_stock"])
        if color not in by_color:
            by_color[color] = {}
        by_color[color][size] = stock

    # Build detailed text summary
    details_lines = []
    for color, sizes in by_color.items():
        size_strs = [f"Size {s}: {qty} chiếc" for s, qty in sizes.items()]
        details_lines.append(f"- **Màu {color}:** " + ", ".join(size_strs))

    specific_notes = []
    if requested_size:
        size_found = []
        for color, sizes in by_color.items():
            if requested_size in sizes:
                size_found.append(f"Màu {color}: {sizes[requested_size]} chiếc")
        if size_found:
            specific_notes.append(f"👉 **Size {requested_size}**: " + ", ".join(size_found))
        else:
            specific_notes.append(f"👉 **Size {requested_size}**: Hiện không có trong danh sách phân loại của sản phẩm này.")

    if requested_color:
        color_found = []
        for color, sizes in by_color.items():
            if requested_color.lower() in color.lower():
                size_strs = [f"Size {s}: {qty} chiếc" for s, qty in sizes.items()]
                color_found.append(f"Màu {color} (" + ", ".join(size_strs) + ")")
        if color_found:
            specific_notes.append(f"👉 **Màu {requested_color}**: " + "; ".join(color_found))

    return {
        "sql": sql_query.strip(),
        "product": product,
        "total_stock": total_stock,
        "min_price": min_price,
        "image_url": image_url,
        "by_color": by_color,
        "details_lines": details_lines,
        "specific_notes": specific_notes,
        "variants": rows,
    }
