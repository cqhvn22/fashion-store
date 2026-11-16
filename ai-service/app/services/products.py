"""Incremental product RAG index from the workbook and live Catalog service."""

from __future__ import annotations

import hashlib
import json
import math
import re
import threading
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid5, NAMESPACE_URL

import httpx

from app.core.db import connection
from app.core.settings import (AI_EMBEDDING_MODEL, CATALOG_SERVICE_URL,
                               INTERNAL_API_KEY, WORKBOOK_PATH)
from app.ingestion.workbook import load_products
from app.services.model import embed

EMBEDDING_INDEX_ID = f"{AI_EMBEDDING_MODEL}:ollama-v1"

_lock = threading.Lock()
sync_status: dict = {"workbook": None, "catalog": None, "last_sync": None,
                     "started_at": None, "running": False, "queued": False, "error": None}


def document_text(item: dict) -> str:
    lines = [f"Sản phẩm: {item['name']}", f"Danh mục: {item['category']}",
             f"Giá: {item['price']:,} VNĐ"]
    if item.get("original_price") and item["original_price"] > item["price"]:
        lines.append(f"Giá gốc: {item['original_price']:,} VNĐ")
    if item.get("colors"):
        lines.append("Màu: " + ", ".join(item["colors"]))
    if item.get("sizes"):
        lines.append("Kích cỡ: " + ", ".join(item["sizes"]))
    if item.get("material"):
        lines.append("Chất liệu ghi trong dữ liệu: " + item["material"])
    if item.get("description"):
        lines.append("Mô tả: " + item["description"][:800])
    if item.get("in_stock") is False:
        lines.append("Tình trạng: hết hàng")
    elif item["source"] == "workbook":
        lines.append("Tồn kho: chỉ là trạng thái tại thời điểm lập bảng tính")
    else:
        lines.append("Tình trạng: còn hàng")
    return "\n".join(lines)


def replace_source(source: str, records: list[dict]) -> dict:
    if source not in {"workbook", "catalog"}:
        raise ValueError("Unsupported source")
    if any(record.get("source") != source for record in records):
        raise ValueError("Source mismatch")
    ids = [str(record["source_id"]) for record in records]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate source ID")
    with connection() as db:
        rows = db.execute("SELECT source_id,content_hash,embedding_model FROM product_documents WHERE source=%s",
                          (source,)).fetchall()
    previous = {row["source_id"]: row for row in rows}
    changed = []
    for record in records:
        content = document_text(record)
        digest = hashlib.sha256(json.dumps({**record, "content": content},
                                           ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        old = previous.get(record["source_id"])
        if not old or old["content_hash"] != digest or old["embedding_model"] != EMBEDDING_INDEX_ID:
            changed.append((record, content, digest))
    for start in range(0, len(changed), 12):
        batch = changed[start:start + 12]
        vectors = embed([content for _, content, _ in batch],
                        keep_alive="2m" if start + 12 < len(changed) else 0)
        if len(vectors) != len(batch):
            raise ValueError("Embedding count mismatch")
        with connection() as db:
            for (item, content, digest), vector in zip(batch, vectors):
                db.execute(
                    "INSERT INTO product_documents "
                    "(id,source,source_id,slug,name,category,price,original_price,colors,sizes,"
                    "material,image_url,product_url,in_stock,content,content_hash,embedding_model,embedding) "
                    "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) "
                    "ON CONFLICT (source,source_id) DO UPDATE SET "
                    "slug=EXCLUDED.slug,name=EXCLUDED.name,category=EXCLUDED.category,"
                    "price=EXCLUDED.price,original_price=EXCLUDED.original_price,"
                    "colors=EXCLUDED.colors,sizes=EXCLUDED.sizes,material=EXCLUDED.material,"
                    "image_url=EXCLUDED.image_url,product_url=EXCLUDED.product_url,"
                    "in_stock=EXCLUDED.in_stock,content=EXCLUDED.content,"
                    "content_hash=EXCLUDED.content_hash,embedding_model=EXCLUDED.embedding_model,"
                    "embedding=EXCLUDED.embedding,updated_at=now()",
                    (uuid5(NAMESPACE_URL, f"fashion-rag:{source}:{item['source_id']}"),
                     source, item["source_id"], item["slug"], item["name"], item["category"],
                     item["price"], item.get("original_price"), item.get("colors", []),
                     item.get("sizes", []), item.get("material"), item.get("image_url"),
                     item.get("product_url"), item.get("in_stock"), content, digest,
                     EMBEDDING_INDEX_ID, vector))
    with connection() as db:
        db.execute("DELETE FROM product_documents WHERE source=%s AND NOT (source_id = ANY(%s))",
                   (source, ids))
    return {"total": len(records), "indexed": len(changed),
            "deleted": len(set(previous) - set(ids))}


def catalog_records() -> list[dict]:
    if not INTERNAL_API_KEY:
        raise RuntimeError("INTERNAL_API_KEY is not configured")
    result = []
    with httpx.Client(timeout=30) as client:
        page = 1
        while True:
            response = client.get(f"{CATALOG_SERVICE_URL}/api/v1/internal/ai-products",
                                  params={"page": page, "limit": 100},
                                  headers={"X-Internal-Key": INTERNAL_API_KEY})
            response.raise_for_status()
            data = response.json()["data"]
            for item in data["content"]:
                result.append({
                    "source": "catalog", "source_id": str(item["id"]), "slug": item["slug"],
                    "name": item["name"], "category": item["category"],
                    "price": int(item["price"]), "original_price": item.get("originalPrice"),
                    "colors": item.get("colors") or [], "sizes": item.get("sizes") or [],
                    "material": None, "description": item.get("description") or None,
                    "image_url": item.get("imageUrl"),
                    "product_url": f"/products/{item['slug']}",
                    "in_stock": item.get("inStock"),
                })
            if data["last"]:
                break
            page += 1
    return result


def catalog_product_count() -> tuple[int, bool]:
    """Count visible active products in Catalog; use the last index if it is offline."""
    if INTERNAL_API_KEY:
        try:
            with httpx.Client(timeout=6) as client:
                response = client.get(
                    f"{CATALOG_SERVICE_URL}/api/v1/internal/ai-products",
                    params={"page": 1, "limit": 1},
                    headers={"X-Internal-Key": INTERNAL_API_KEY},
                )
                response.raise_for_status()
                return int(response.json()["data"]["totalElements"]), True
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            pass
    with connection() as db:
        row = db.execute(
            "SELECT count(*) AS total FROM product_documents WHERE source='catalog'"
        ).fetchone()
    return int(row["total"]), False


def sync_all() -> dict:
    if not _lock.acquire(blocking=False):
        return {**sync_status, "busy": True}
    errors = []
    try:
        sync_status["queued"] = False
        sync_status["running"] = True
        sync_status["started_at"] = datetime.now(timezone.utc).isoformat()
        try:
            workbook, report = load_products(Path(WORKBOOK_PATH))
            sync_status["workbook"] = {**replace_source("workbook", workbook), "quality": report}
        except Exception as error:
            errors.append(f"workbook: {error}")
        try:
            sync_status["catalog"] = replace_source("catalog", catalog_records())
        except Exception as error:
            errors.append(f"catalog: {error}")
        sync_status["last_sync"] = datetime.now(timezone.utc).isoformat()
        sync_status["error"] = "; ".join(errors) or None
        return dict(sync_status)
    finally:
        sync_status["running"] = False
        _lock.release()


def _budget(question: str) -> int | None:
    match = re.search(r"(?:dưới|không quá|tối đa|budget|ngân sách)\s*(\d+(?:[.,]\d+)?)\s*(triệu|tr|nghìn|ngàn|k)?",
                      question.lower())
    if not match:
        return None
    raw = match.group(1)
    unit = match.group(2)
    if unit is None and re.fullmatch(r"\d{1,3}[.,]\d{3}", raw):
        return int(raw.replace(".", "").replace(",", ""))
    value = float(raw.replace(",", "."))
    return int(value * (1_000_000 if unit in {"triệu", "tr"} else 1000 if unit in {"nghìn", "ngàn", "k"} else 1))


def _requested_size(question: str) -> str | None:
    match = re.search(r"\b(?:size|cỡ)\s*(4XL|3XL|2XL|XL|XS|S|M|L|2[8-9]|3[0-9]|4[0-5])\b",
                      question, re.I)
    return match.group(1).upper() if match else None


def _requested_color(question: str, rows: list[dict]) -> str | None:
    match = re.search(r"\bmàu\s+([^,.;!?]+)", question.casefold())
    if not match or match.group(1).split()[0] in {"gì", "nào", "sắc"}:
        return None
    requested = match.group(1).strip()
    colors = sorted({color.casefold() for row in rows for color in row["colors"]}, key=len, reverse=True)
    for color in colors:
        if requested == color or requested.startswith(color + " "):
            return color
    return requested.split()[0]


def _requested_types(question: str) -> list[str]:
    return [kind for kind in ("áo", "quần", "giày", "dép", "túi", "balo", "mũ", "tất", "dây lưng")
            if re.search(rf"\b{re.escape(kind)}\b", question.casefold())]


def retrieve_products(question: str, limit: int = 5) -> list[dict]:
    budget = _budget(question)
    with connection() as db:
        rows = db.execute(
            "SELECT id,source,source_id,slug,name,category,price,colors,sizes,"
            "product_url,image_url,in_stock,content,embedding FROM product_documents p "
            "WHERE embedding_model=%s AND source='catalog' AND in_stock IS DISTINCT FROM FALSE",
            (EMBEDDING_INDEX_ID,)).fetchall()
    # Indexed prices are retrieval hints only; live Catalog pricing is checked before reply.
    size = _requested_size(question)
    if size:
        rows = [row for row in rows if size in {value.upper() for value in row["sizes"]}]
    color = _requested_color(question, rows)
    if color:
        rows = [row for row in rows if color in {value.casefold() for value in row["colors"]}]
    kinds = _requested_types(question)
    if kinds:
        rows = [row for row in rows if any(
            kind in f"{row['name']} {row['category']}".casefold() for kind in kinds)]
    if not rows:
        return []

    q_lower = question.lower()
    is_summer = any(w in q_lower for w in ("mùa hè", "hè", "mát", "thoáng", "ngắn tay", "cộc tay", "nóng", "oi bức"))
    is_winter = any(w in q_lower for w in ("mùa đông", "đông", "ấm", "rét", "lạnh", "dày", "giữ nhiệt"))

    if is_summer:
        summer_rows = [
            row for row in rows
            if not any(w in f"{row['name']} {row['category']}".lower() for w in ("nỉ", "len", "phao", "dày", "khoác gió dày", "giữ nhiệt"))
        ]
        if summer_rows:
            rows = summer_rows
    elif is_winter:
        winter_rows = [
            row for row in rows
            if any(w in f"{row['name']} {row['category']}".lower() for w in ("nỉ", "len", "khoác", "phao", "dài tay", "ấm", "dày"))
        ]
        if winter_rows:
            rows = winter_rows

    try:
        vector = embed([question])[0]
        norm = math.sqrt(sum(value * value for value in vector))
    except Exception:
        vector = []
        norm = 0
    words = set(re.findall(r"\w+", question.lower())) - {"cho", "tôi", "muốn", "một", "cái", "và", "có"}
    ranked = []
    for row in rows:
        stored = row.get("embedding") or []
        semantic = 0.0
        if vector and stored and len(stored) == len(vector):
            row_norm = math.sqrt(sum(value * value for value in stored))
            semantic = sum(a * b for a, b in zip(vector, stored)) / (norm * row_norm) if norm and row_norm else 0
        label = f"{row['name']} {row['category']} {' '.join(row.get('colors') or [])} {' '.join(row.get('sizes') or [])}".lower()
        lexical = sum(1 for word in words if len(word) > 1 and word in label) / max(len(words), 1)
        score = (0.85 * semantic + 0.15 * lexical) if vector else lexical
        if is_summer and any(w in label for w in ("phông", "polo", "hè", "ngắn tay", "cotton")):
            score += 0.2
        elif is_winter and any(w in label for w in ("nỉ", "len", "khoác", "phao", "ấm")):
            score += 0.2
        if score >= 0.18:
            ranked.append({**row, "score": max(0.0, min(1.0, score))})
    return sorted(ranked, key=lambda row: row["score"], reverse=True)[:limit]


def refresh_live_products(candidates: list[dict], question: str) -> list[dict]:
    """Recheck selected catalog items against the transactional Catalog source."""
    budget = _budget(question)
    refreshed = []
    with httpx.Client(timeout=6) as client:
        for item in candidates:
            if item.get("source") != "catalog":
                if budget is None or item.get("price", 0) <= budget:
                    refreshed.append(item)
                continue
            try:
                response = client.get(f"{CATALOG_SERVICE_URL}/api/v1/products/slug/{item['slug']}")
                if response.status_code == 404:
                    continue
                response.raise_for_status()
                live = response.json()["data"]
                variants = [v for v in live.get("variants", [])
                            if v.get("isActive") and int(v.get("stockQuantity") or 0) > 0]
                if not variants:
                    continue
                price = min(int(v["price"]) for v in variants)
                if budget is not None and price > budget:
                    continue
                matching = min(variants, key=lambda v: int(v["price"]))
                refreshed.append({**item, "name": live["name"], "price": price,
                                  "original_price": matching.get("compareAtPrice"),
                                  "promotion": (live.get("promotion") or {}).get("name"),
                                  "colors": list(dict.fromkeys(v["color"] for v in variants)),
                                  "sizes": list(dict.fromkeys(v["size"] for v in variants)),
                                  "image_url": (live.get("images") or [{}])[0].get("url") or item.get("image_url")})
            except (httpx.HTTPError, KeyError, TypeError, ValueError) as error:
                raise RuntimeError("Không thể kiểm tra giá sản phẩm hiện tại.") from error
    return refreshed
