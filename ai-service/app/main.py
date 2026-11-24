import asyncio
import logging
import re
import hmac
import httpx
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query
from fastapi.encoders import jsonable_encoder
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.core.db import connection, migrate
from app.core.security import admin_user, current_user
from app.services.knowledge import (index_document, retrieve, seed_default_policies,
                                    index_missing_policies, find_exact_response_rule)
from app.services.model import generate_ai_chat, choose_products
from app.services.conversation import catalog_count_question, size_followup, retrieval_query, store_location_question
from app.services.products import catalog_product_count, retrieve_products, refresh_live_products, sync_all, sync_status
from app.services.inventory import (is_inventory_inquiry, resolve_product_for_inventory,
                                    query_live_inventory, extract_requested_size, extract_requested_color)
from app.core.settings import PRODUCT_SYNC_SECONDS, AI_PROVIDER, AI_CHAT_MODEL, ORDER_SERVICE_URL, INTERNAL_API_KEY

app = FastAPI(title="Fashion AI Service")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger = logging.getLogger(__name__)
_sync_task: asyncio.Task | None = None
_policy_task: asyncio.Task | None = None


def ok(data):
    return {"success": True, "data": jsonable_encoder(data),
            "timestamp": datetime.now(timezone.utc).isoformat()}


class KnowledgeInput(BaseModel):
    title: str = Field(min_length=3, max_length=250)
    content: str = Field(min_length=10, max_length=50000)


class KnowledgeVisibility(BaseModel):
    isActive: bool


class ChatInput(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    conversationId: str | UUID | None = None


@app.on_event("startup")
async def startup() -> None:
    migrate()
    seed_default_policies()
    global _sync_task
    _sync_task = asyncio.create_task(sync_loop())
    global _policy_task
    _policy_task = asyncio.create_task(asyncio.to_thread(index_missing_policies))


@app.on_event("shutdown")
async def shutdown() -> None:
    if _sync_task:
        _sync_task.cancel()
    if _policy_task:
        _policy_task.cancel()


async def sync_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(sync_all)
        except Exception:
            logger.exception("Product index sync failed")
        await asyncio.sleep(max(30, PRODUCT_SYNC_SECONDS))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "rag": "ready" if sync_status.get("catalog") else "indexing"}


@app.get("/api/v1/admin/ai/index-status")
def index_status(_: dict = Depends(admin_user)):
    with connection() as db:
        rows = db.execute("SELECT source,count(*) AS total FROM product_documents GROUP BY source").fetchall()
    return ok({**sync_status, "documents": {row["source"]: row["total"] for row in rows}})


@app.post("/api/v1/admin/ai/reindex", status_code=202)
def reindex(background: BackgroundTasks, _: dict = Depends(admin_user)):
    if sync_status["running"] or sync_status["queued"]:
        raise HTTPException(status_code=409, detail="Product knowledge refresh is already running")
    sync_status["queued"] = True
    background.add_task(sync_all)
    return ok({"queued": True})


@app.post("/api/v1/internal/ai/reindex", status_code=202)
def internal_reindex(background: BackgroundTasks,
                     x_internal_key: str | None = Header(default=None)):
    if not INTERNAL_API_KEY or not x_internal_key or not hmac.compare_digest(x_internal_key, INTERNAL_API_KEY):
        raise HTTPException(status_code=403, detail="Forbidden")
    if sync_status["running"] or sync_status["queued"]:
        return ok({"queued": False, "running": True})
    sync_status["queued"] = True
    background.add_task(sync_all)
    return ok({"queued": True})


@app.get("/api/v1/admin/knowledge")
def list_knowledge(q: str = Query(default="", max_length=250),
                   status: str | None = Query(default=None, pattern="^(PENDING|INDEXED|FAILED)$"),
                   _: dict = Depends(admin_user)):
    with connection() as db:
        rows = db.execute(
            'SELECT d.id,d.title,d.content,d.status,d.is_active AS "isActive",'
            'd.last_error AS "lastError",d.indexed_at AS "indexedAt",'
            'd.created_at AS "createdAt",d.updated_at AS "updatedAt",'
            'count(c.id)::integer AS "chunkCount" '
            "FROM knowledge_documents d LEFT JOIN knowledge_chunks c ON c.document_id=d.id "
            "WHERE (%s='' OR d.title ILIKE '%%' || %s || '%%' OR d.content ILIKE '%%' || %s || '%%') "
            "AND (CAST(%s AS text) IS NULL OR d.status=%s) "
            "GROUP BY d.id ORDER BY d.updated_at DESC",
            (q, q, q, status, status),
        ).fetchall()
    return ok(rows)


@app.post("/api/v1/admin/knowledge")
def create_knowledge(payload: KnowledgeInput, background: BackgroundTasks,
                     user: dict = Depends(admin_user)):
    title, content = payload.title.strip(), payload.content.strip()
    if len(title) < 3 or len(content) < 10:
        raise HTTPException(status_code=422, detail="Title or content is too short")
    document_id = uuid4()
    with connection() as db:
        db.execute(
            "INSERT INTO knowledge_documents(id,title,content,created_by) VALUES (%s,%s,%s,%s)",
            (document_id, title, content, UUID(user["sub"])),
        )
    background.add_task(index_document, document_id, content)
    return knowledge(document_id)


@app.get("/api/v1/admin/knowledge/{document_id}")
def get_knowledge(document_id: UUID, _: dict = Depends(admin_user)):
    return knowledge(document_id)


@app.put("/api/v1/admin/knowledge/{document_id}")
def update_knowledge(document_id: UUID, payload: KnowledgeInput, background: BackgroundTasks,
                     _: dict = Depends(admin_user)):
    title, content = payload.title.strip(), payload.content.strip()
    if len(title) < 3 or len(content) < 10:
        raise HTTPException(status_code=422, detail="Title or content is too short")
    with connection() as db:
        changed = db.execute(
            "UPDATE knowledge_documents SET title=%s,content=%s,status='PENDING',last_error=NULL,updated_at=now() "
            "WHERE id=%s RETURNING id",
            (title, content, document_id),
        ).fetchone()
    if not changed:
        raise HTTPException(status_code=404, detail="Document not found")
    background.add_task(index_document, document_id, content)
    return knowledge(document_id)


@app.post("/api/v1/admin/knowledge/{document_id}/reindex", status_code=202)
def reindex_knowledge(document_id: UUID, background: BackgroundTasks,
                      _: dict = Depends(admin_user)):
    with connection() as db:
        row = db.execute(
            "UPDATE knowledge_documents SET status='PENDING',last_error=NULL,updated_at=now() "
            "WHERE id=%s RETURNING content", (document_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    background.add_task(index_document, document_id, row["content"])
    return knowledge(document_id)


@app.patch("/api/v1/admin/knowledge/{document_id}/active")
def set_knowledge_visibility(document_id: UUID, payload: KnowledgeVisibility,
                             _: dict = Depends(admin_user)):
    with connection() as db:
        row = db.execute("UPDATE knowledge_documents SET is_active=%s,updated_at=now() "
                         "WHERE id=%s RETURNING id", (payload.isActive, document_id)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return knowledge(document_id)


@app.delete("/api/v1/admin/knowledge/{document_id}")
def delete_knowledge(document_id: UUID, _: dict = Depends(admin_user)):
    with connection() as db:
        deleted = db.execute(
            "DELETE FROM knowledge_documents WHERE id=%s RETURNING id", (document_id,)
        ).fetchone()
    if not deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    return ok({})


def knowledge(document_id: UUID):
    with connection() as db:
        row = db.execute(
            'SELECT d.id,d.title,d.content,d.status,d.is_active AS "isActive",'
            'd.last_error AS "lastError",d.indexed_at AS "indexedAt",'
            'd.created_at AS "createdAt",d.updated_at AS "updatedAt",'
            'count(c.id)::integer AS "chunkCount" '
            "FROM knowledge_documents d LEFT JOIN knowledge_chunks c ON c.document_id=d.id "
            "WHERE d.id=%s GROUP BY d.id", (document_id,)
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return ok(row)


def extract_amount_vnd(text: str) -> int | None:
    t = text.lower().replace(",", "").replace(".", "")
    m_tr = re.search(r"(\d+(?:\.\d+)?)\s*(?:triệu|tr)\b", text.lower())
    if m_tr:
        try:
            return int(float(m_tr.group(1)) * 1_000_000)
        except ValueError:
            pass
    m_k = re.search(r"(\d+)\s*(?:k|nghìn|ngàn)\b", t)
    if m_k:
        try:
            return int(m_k.group(1)) * 1000
        except ValueError:
            pass
    m_num = re.search(r"(\d{5,9})\b", t)
    if m_num:
        try:
            return int(m_num.group(1))
        except ValueError:
            pass
    m_vnd = re.search(r"(\d+)\s*(?:vnd|vnđ|đ)\b", t)
    if m_vnd:
        try:
            v = int(m_vnd.group(1))
            return v * 1000 if v < 1000 else v
        except ValueError:
            pass
    return None


def format_product_excerpt(row: dict) -> str:
    parts = []
    if row.get("price"):
        parts.append(f"{row['price']:,}đ".replace(",", "."))
    if row.get("colors"):
        colors = row["colors"] if isinstance(row["colors"], list) else []
        if colors:
            parts.append(f"Màu: {', '.join(colors[:3])}")
    if row.get("sizes"):
        sizes = row["sizes"] if isinstance(row["sizes"], list) else []
        if sizes:
            parts.append(f"Size: {', '.join(sizes[:4])}")
    if row.get("category"):
        parts.append(f"Danh mục: {row['category']}")
    return " • ".join(parts) if parts else (row.get("name") or "")


@app.post("/api/v1/chat")
def chat(payload: ChatInput, user: dict | None = Depends(current_user)):
    owner = UUID(user["sub"]) if user else None
    raw_conv_id = payload.conversationId
    if raw_conv_id is None:
        conversation_id = uuid4()
    elif isinstance(raw_conv_id, UUID):
        conversation_id = raw_conv_id
    else:
        try:
            conversation_id = UUID(str(raw_conv_id))
        except ValueError:
            import uuid
            conversation_id = uuid.uuid5(uuid.NAMESPACE_DNS, str(raw_conv_id))
    with connection() as db:
        existing = db.execute(
            "SELECT user_id FROM conversations WHERE id=%s", (conversation_id,)
        ).fetchone()
        if existing and existing["user_id"] != owner:
            raise HTTPException(status_code=403, detail="Conversation does not belong to user")
        if existing is None:
            db.execute(
                "INSERT INTO conversations(id,user_id) VALUES (%s,%s)", (conversation_id, owner)
            )
        # Fetch previous message history for multi-turn AI context
        history_rows = db.execute(
            "SELECT role, content FROM chat_messages "
            "WHERE conversation_id=%s ORDER BY created_at DESC LIMIT 8",
            (conversation_id,)
        ).fetchall()
        db.execute(
            "INSERT INTO chat_messages(id,conversation_id,role,content) VALUES (%s,%s,'USER',%s)",
            (uuid4(), conversation_id, payload.message),
        )

    history = [{"role": r["role"].lower(), "content": r["content"]} for r in reversed(history_rows)]
    raw_text = payload.message.strip()
    question = raw_text.lower()
    amount = extract_amount_vnd(raw_text)
    customer_context = ""
    if user and INTERNAL_API_KEY:
        try:
            with httpx.Client(timeout=4) as client:
                loyalty_response = client.get(
                    f"{ORDER_SERVICE_URL}/api/v1/internal/loyalty/{user['sub']}",
                    headers={"X-Internal-Key": INTERNAL_API_KEY})
                loyalty_response.raise_for_status()
                loyalty = loyalty_response.json()["data"]
                names = {"MEMBER": "Thành viên", "SILVER": "Bạc", "GOLD": "Vàng", "DIAMOND": "Kim Cương"}
                customer_context = (f"Khách đã đăng nhập thuộc hạng {names.get(loyalty['tier'], 'Thành viên')}, "
                                    f"có {loyalty['points']} điểm. Chỉ cá nhân hóa theo hạng này; "
                                    "không tự tạo ưu đãi hoặc giá nếu chưa có nguồn xác nhận.")
                offers = loyalty.get("offers") or []
                if offers:
                    customer_context += " Ưu đãi thực tế dành cho hạng này: " + "; ".join(
                        f"{offer['name']} ({offer['discountValue']}{'%' if offer['discountType'] == 'PERCENT' else 'đ'}, "
                        f"đơn tối thiểu {offer['minSubtotal']}đ, hết hạn {offer['endsAt']})"
                        for offer in offers[:5])
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            logger.warning("Could not load current loyalty tier for chat")

    # 1. Greeting detection
    greeting_patterns = [
        r"^(?:xin\s+)?chào(?:\s+(?:bạn|shop|ad|fashionhub|em|anh|chị))?[!.]*$",
        r"^(?:hello|hi|hey|alo|hola|bonjour)[!.]*$",
        r"^(?:bạn\s+là\s+ai|ai\s+đấy|bạn\s+tên\s+gì|who\s+are\s+you|bạn\s+có\s+thể\s+làm\s+gì|trợ\s+giúp|help|menu)[!.]*$",
        r"^chào\s+(?:buổi\s+)?(?:sáng|chiều|tối)[!.]*$",
    ]
    is_greeting = any(re.search(pat, question) for pat in greeting_patterns)

    # 2. Shipping calculation or shipping inquiry
    is_shipping_inquiry = any(term in question for term in (
        "freeship", "miễn ship", "free ship", "miễn phí vận chuyển", "miễn phí giao hàng",
        "phí ship", "tiền ship", "phí giao", "tiền giao", "phí vận chuyển", "bao lâu nhận",
        "mấy ngày nhận", "đồng kiểm", "tiền vận chuyển"
    )) or (amount is not None and any(term in question for term in ("ship", "giao", "vận chuyển", "freeship"))) or (
        "ship" in question and any(term in question for term in ("bao nhiêu", "thế nào", "sao", "có được", "không", "miễn", "hết bao", "tính"))
    )

    # 3. Cart / Orders / Payment inquiry (core web features, NEVER off-topic!)
    is_cart_inquiry = any(term in question for term in (
        "giỏ hàng", "giỏ đồ", "trong giỏ", "xem giỏ", "thêm vào giỏ", "cart", "giỏ của tôi"
    ))
    is_order_inquiry = any(term in question for term in (
        "đơn hàng", "đơn mua", "tra cứu đơn", "kiểm tra đơn", "tình trạng đơn", "hóa đơn", "hủy đơn", "mã đơn"
    ))
    is_payment_inquiry = any(term in question for term in (
        "thanh toán", "trả tiền", "phương thức thanh toán", "vnpay", "cod", "quẹt thẻ", "chuyển khoản"
    ))

    # 4. Other store policies
    is_returns_inquiry = any(term in question for term in ("đổi trả", "đổi hàng", "trả hàng", "đổi size", "hoàn tiền", "7 ngày"))
    is_size_inquiry = (
        any(term in question for term in ("chọn size", "bảng size", "tư vấn size", "chiều cao", "cân nặng", "mặc size", "mua size", "kích cỡ", "vừa không", "hướng dẫn size"))
        or bool(re.search(r"\bsize\s+(?:gì|nào|bao nhiêu|sao)\b", question))
        or bool(re.search(r"\b(?:mặc|mua|chọn|lấy|hợp|vừa)\s+size\b", question))
        or (bool(re.search(r"\b\d+\s*kg\b", question)) or bool(re.search(r"\b\d+m\d*\b", question)))
    )
    is_terms_inquiry = any(term in question for term in ("hotline", "tổng đài", "số điện thoại", "bảo hành", "chính hãng", "liên hệ", "cskh", "điều khoản", "bảo mật", "uy tín"))
    is_size_inquiry = is_size_inquiry or size_followup(raw_text, history)
    is_policy = is_shipping_inquiry or is_returns_inquiry or is_size_inquiry or is_terms_inquiry
    search_query = retrieval_query(raw_text, sizing=is_size_inquiry)

    # 5. Explicit Off-topic check
    off_topic_patterns = (
        "thời tiết", "chứng khoán", "toán học", "giải phương trình", "viết code", "lập trình",
        "python", "javascript", "java", "bóng đá", "tổng thống", "chính trị", "công thức nấu",
        "bệnh viện", "thuốc", "y tế", "xổ số", "chiến tranh", "lịch sử thế giới", "giá vàng",
        "bitcoin", "crypto", "tiền ảo"
    )
    is_off_topic_query = any(w in question for w in off_topic_patterns)

    # 6. Product shopping & styling inquiry
    is_product_inquiry = (
        any(re.search(rf"\b{re.escape(term)}\b", question) for term in (
            "áo", "quần", "khoác", "sơ mi", "polo", "thun", "len", "nỉ", "hoodie", "jeans", "jean",
            "kaki", "âu", "short", "sooc", "giày", "dép", "balo", "túi", "ví", "thắt lưng",
            "dây lưng", "nón", "mũ", "tất", "vớ", "bộ", "outfit", "set", "phụ kiện",
            "cotton", "linen", "phối đồ", "gợi ý đồ", "gợi ý trang phục"
        )) or any(p in question for p in ("gợi ý", "tư vấn áo", "tư vấn quần", "mẫu nào đẹp", "có mẫu", "mẫu mới", "bán chạy"))
    ) and not (is_shipping_inquiry and not any(w in question for w in ("gợi ý", "phối", "mẫu", "tìm")))
    is_catalog_count = catalog_count_question(raw_text)
    is_inventory = is_inventory_inquiry(raw_text) and not is_off_topic_query
    inv_target_product = resolve_product_for_inventory(raw_text, conversation_id, history) if is_inventory else None
    product_matches = []
    matches = []
    answer_origin = "MODEL"
    exact_rule = find_exact_response_rule(payload.message)

    if store_location_question(raw_text):
        response_text = "FashionHub hiện chỉ hỗ trợ mua sắm trực tuyến và chưa có chức năng tra cứu cửa hàng. Bạn có thể xem sản phẩm trên website hoặc liên hệ bộ phận hỗ trợ."
        answer_origin = "UNSUPPORTED_FEATURE"
    elif exact_rule:
        # A rule configured by an admin is intentionally deterministic.
        matches = [{"id": exact_rule["id"], "document_id": exact_rule["id"],
                    "title": exact_rule["title"], "content": exact_rule["content"],
                    "score": 1.0, "kind": "knowledge"}]
        response_text = exact_rule["answer"]
        answer_origin = "RULE"
    elif is_catalog_count:
        count, live = catalog_product_count()
        if count == 0 and not live:
            raise HTTPException(status_code=503, detail="Chưa lấy được số lượng sản phẩm từ cửa hàng.")
        count_context = (
            f"Catalog cửa hàng có {count} sản phẩm đang hiển thị."
            if live else f"Chỉ mục Catalog đồng bộ gần nhất có {count} sản phẩm; số lượng hiện tại chưa được xác nhận."
        )
        matches = [{"title": "Thống kê danh mục cửa hàng", "content": count_context,
                    "source_url": "/products", "score": 1.0, "kind": "knowledge"}]
        response_text = generate_ai_chat(
            raw_text, history, [count_context], [],
            system_instruction=(
                "Trả lời câu hỏi về tổng số sản phẩm chỉ bằng số liệu thống kê TL1 của lượt này. "
                "Các sản phẩm SP trong lịch sử chỉ là mẫu gợi ý, không phải tổng số; "
                "Không cộng thêm sản phẩm mẫu trong lịch sử. "
                + ("Đây là số trực tiếp từ Catalog; không gọi là chỉ mục đồng bộ."
                   if live else "Đây là chỉ mục đồng bộ gần nhất; chưa xác nhận số hiện tại.")
            ),
            customer_context=customer_context,
        )
    elif is_off_topic_query:
        response_text = generate_ai_chat(raw_text, history, [], [], is_off_topic=True, customer_context=customer_context)
    elif is_inventory and inv_target_product:
        req_size = extract_requested_size(raw_text)
        req_color = extract_requested_color(raw_text)
        inv_data = query_live_inventory(inv_target_product, req_size, req_color)
        price_val = inv_data["min_price"] or inv_target_product.get("original_price") or 0
        price_str = f"{price_val:,} đ".replace(",", ".")

        product_matches = [{
            "id": str(inv_target_product["id"]),
            "source_id": str(inv_target_product["id"]),
            "source": "catalog",
            "name": inv_target_product["name"],
            "slug": inv_target_product["slug"],
            "price": price_val,
            "image_url": inv_data.get("image_url") or "/images/product-placeholder.svg",
            "product_url": f"/products/{inv_target_product['slug']}",
            "score": 1.0,
        }]
        matches = [{
            "id": str(inv_target_product["id"]),
            "document_id": str(inv_target_product["id"]),
            "title": inv_target_product["name"],
            "content": f"{price_str} • Tồn kho khả dụng: {inv_data['total_stock']} chiếc",
            "source_url": f"/products/{inv_target_product['slug']}",
            "image_url": inv_data.get("image_url") or "/images/product-placeholder.svg",
            "score": 1.0,
            "kind": "product",
            "source_id": str(inv_target_product["id"]),
            "source": "catalog",
        }]

        db_instruction = (
            f"Hệ thống đã tự động tạo và thực thi câu lệnh SQL truy vấn CSDL PostgreSQL bảng `product_variants`:\n"
            f"{inv_data['sql']}\n\n"
            f"KẾT QUẢ TRUY VẤN TỒN KHO THỜI GIAN THỰC TỪ CSDL:\n"
            f"- Tên sản phẩm: {inv_target_product['name']}\n"
            f"- Giá bán: {price_str}\n"
            f"- Tổng số lượng còn trong kho: {inv_data['total_stock']} chiếc\n"
            f"- Chi tiết từng biến thể:\n" + "\n".join(inv_data['details_lines'])
        )
        if inv_data.get("specific_notes"):
            db_instruction += "\n" + "\n".join(inv_data["specific_notes"])
        db_instruction += (
            f"\n\nBẮT BUỘC: Trả lời trực tiếp và rõ ràng dựa trên số liệu CSDL trên:\n"
            f"1. **{inv_target_product['name']}**\n"
            f"- Giá bán: {price_str}\n"
            f"- Tình trạng: {'Còn hàng' if inv_data['total_stock'] > 0 else 'Tạm hết hàng'} (Tổng {inv_data['total_stock']} chiếc trong kho)\n"
            "Nêu rõ các size và màu sắc còn hàng. Không được nói 'không có số liệu tồn kho'."
        )

        fallback_text = (
            f"Dữ liệu tồn kho thời gian thực truy vấn trực tiếp từ cơ sở dữ liệu hệ thống (CSDL Catalog - bảng `product_variants`):\n\n"
            f"1. **{inv_target_product['name']}**\n"
            f"- Giá bán: {price_str}\n"
            f"- Tình trạng: {'Còn hàng' if inv_data['total_stock'] > 0 else 'Tạm hết hàng'} (Tổng {inv_data['total_stock']} chiếc trong kho)\n"
            f"- Chi tiết số lượng còn theo màu sắc & kích cỡ:\n"
            + "\n".join(inv_data['details_lines'])
        )
        if inv_data.get("specific_notes"):
            fallback_text += "\n" + "\n".join(inv_data["specific_notes"])
        fallback_text += "\n\nBạn muốn đặt màu hoặc size nào để mình hỗ trợ giữ hàng nhé?"

        response_text = generate_ai_chat(
            raw_text, history, [], product_matches,
            system_instruction=db_instruction,
            fallback_text=fallback_text,
            customer_context=customer_context,
        )
    elif is_inventory and not is_product_inquiry:
        response_text = "Bạn đang muốn kiểm tra tồn kho cho sản phẩm nào? Bạn có thể cho mình biết tên sản phẩm hoặc mã SP (ví dụ: SP1, SP2) để mình tra cứu kho cho bạn nhé."
        answer_origin = "PRODUCT_NEEDED"
    elif is_product_inquiry:
        try:
            product_matches = refresh_live_products(
                choose_products(raw_text, retrieve_products(raw_text, limit=5)), raw_text)
        except RuntimeError:
            raise HTTPException(status_code=503, detail="Chưa kiểm tra được giá sản phẩm hiện tại. Vui lòng thử lại.")
        matches = [{"id": row["id"], "title": row["name"],
                    "content": format_product_excerpt(row),
                    "source_url": row.get("product_url") or f"/products/{row['slug']}",
                    "image_url": row.get("image_url") or "/images/product-placeholder.svg",
                    "score": row.get("score", 0.0), "kind": "product",
                    "source_id": row.get("source_id"), "source": row.get("source")}
                   for row in product_matches]
        if is_policy:
            knowledge_matches = retrieve(search_query, limit=2)
            matches.extend({**row, "kind": "knowledge"} for row in knowledge_matches)
        else:
            knowledge_matches = []
        if product_matches:
            response_text = generate_ai_chat(
                raw_text, history,
                [f"{row['title']}: {row['content']}" for row in knowledge_matches],
                product_matches,
                customer_context=customer_context,
            )
        else:
            response_text = "Mình chưa tìm thấy sản phẩm phù hợp với yêu cầu này. Bạn có thể thử màu, size hoặc mức giá khác."
            answer_origin = "NO_RESULTS"
    elif is_cart_inquiry or is_order_inquiry:
        path = "/cart" if is_cart_inquiry else "/account/orders"
        instruction = (f"Chỉ hướng dẫn khách mở trang {path}. "
                       "Không khẳng định trạng thái giỏ hàng hay đơn hàng vì chưa có dữ liệu cá nhân trong ngữ cảnh.")
        response_text = generate_ai_chat(raw_text, history, [], [], system_instruction=instruction, customer_context=customer_context)
    elif is_payment_inquiry:
        response_text = generate_ai_chat(
            raw_text, history, [], [],
            system_instruction="Các lựa chọn checkout trong hệ thống là COD và PayOS. Không nhắc VNPAY nếu không có nguồn xác nhận.",
            customer_context=customer_context,
        )
    else:
        knowledge_matches = [] if is_greeting else retrieve(search_query, limit=3)
        matches = [{**row, "kind": "knowledge"} for row in knowledge_matches]
        if is_policy and not knowledge_matches:
            response_text = "Mình chưa tìm thấy chính sách phù hợp trong tài liệu đang sử dụng. Vui lòng liên hệ cửa hàng để xác nhận."
            answer_origin = "NO_RESULTS"
        else:
            response_text = generate_ai_chat(
                raw_text, history,
                [f"{row['title']}: {row['content']}" for row in knowledge_matches],
                [], is_greeting=is_greeting,
                customer_context=customer_context,
            )
    message_id = uuid4()
    with connection() as db:
        db.execute(
            "INSERT INTO chat_messages(id,conversation_id,role,content) VALUES (%s,%s,'ASSISTANT',%s)",
            (message_id, conversation_id, response_text),
        )
        for row in matches:
            try:
                db.execute(
                    "INSERT INTO chat_message_sources"
                    "(id,message_id,document_id,chunk_id,title,excerpt,relevance_score,source_url,image_url)"
                    " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    (uuid4(), message_id, None, None,
                     row["title"], (row.get("content") or row.get("excerpt") or "")[:240],
                     row.get("score", 1.0), row.get("source_url"), row.get("image_url")),
                )
            except Exception:
                try:
                    db.execute(
                        "INSERT INTO chat_message_sources"
                        "(id,message_id,document_id,chunk_id,title,excerpt,relevance_score,source_url)"
                        " VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                        (uuid4(), message_id, None, None,
                         row["title"], (row.get("content") or row.get("excerpt") or "")[:240],
                         row.get("score", 1.0), row.get("source_url")),
                    )
                except Exception:
                    pass
        for position, row in enumerate(product_matches):
            if row.get("source") == "catalog" and row.get("source_id"):
                try:
                    db.execute(
                        "INSERT INTO chat_message_product_suggestions"
                        "(message_id,product_id,position) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                        (message_id, UUID(str(row["source_id"])), position)
                    )
                except Exception:
                    pass
        db.execute("UPDATE conversations SET updated_at=now() WHERE id=%s", (conversation_id,))
    return ok({
        "id": message_id,
        "conversationId": conversation_id,
        "role": "ASSISTANT",
        "content": response_text,
        "answerOrigin": answer_origin,
        "provider": AI_PROVIDER if answer_origin == "MODEL" else None,
        "requestedModel": AI_CHAT_MODEL if answer_origin == "MODEL" else None,
        "sources": [
            {
                "documentId": str(row.get("document_id") or row.get("id") or uuid4()),
                "title": row["title"],
                "excerpt": (row.get("content") or row.get("excerpt") or "")[:240],
                "relevanceScore": row.get("score", 1.0),
                "url": row.get("source_url"),
                "imageUrl": row.get("image_url"),
                "citation": (f"SP{index + 1}" if row.get("kind") == "product"
                             else f"TL{index + 1 - len(product_matches)}"),
            }
            for index, row in enumerate(matches)
        ],
        "suggestedProductIds": [
            str(row["source_id"]) for row in product_matches
            if row.get("source") == "catalog" and row.get("source_id")
        ],
        "createdAt": datetime.now(timezone.utc),
    })


@app.get("/api/v1/chat/conversations")
def conversations(user: dict = Depends(current_user)):
    if user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
    with connection() as db:
        rows = db.execute(
            'SELECT id,created_at AS "createdAt",updated_at AS "updatedAt" '
            "FROM conversations WHERE user_id=%s ORDER BY updated_at DESC",
            (UUID(user["sub"]),),
        ).fetchall()
    return ok(rows)


@app.get("/api/v1/chat/conversations/{conversation_id}")
def conversation(conversation_id: UUID, user: dict | None = Depends(current_user)):
    owner = UUID(user["sub"]) if user else None
    with connection() as db:
        row = db.execute(
            "SELECT id,user_id FROM conversations WHERE id=%s", (conversation_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Conversation not found")
        if row["user_id"] != owner:
            raise HTTPException(status_code=403, detail="Conversation does not belong to user")
        messages = db.execute(
            'SELECT id,role,content,created_at AS "createdAt" FROM chat_messages '
            "WHERE conversation_id=%s ORDER BY created_at", (conversation_id,)
        ).fetchall()
    return ok({"id": conversation_id, "messages": messages})


@app.get("/api/v1/admin/ai-conversations")
def admin_conversations(_: dict = Depends(admin_user)):
    with connection() as db:
        rows = db.execute(
            'SELECT id,user_id AS "userId",created_at AS "createdAt",'
            'updated_at AS "updatedAt" FROM conversations ORDER BY updated_at DESC LIMIT 500'
        ).fetchall()
    return ok(rows)
