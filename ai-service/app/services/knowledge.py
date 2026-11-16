import logging
import math
import re
from uuid import UUID, uuid4

from app.core.db import connection
from app.core.settings import AI_EMBEDDING_MODEL
from app.services.model import embed

EMBEDDING_INDEX_ID = f"{AI_EMBEDDING_MODEL}:ollama-v1"

logger = logging.getLogger(__name__)


def response_rule(title: str, content: str) -> tuple[str, str] | None:
    """Recognize an administrator's exact-response rule without asking the LLM to obey it."""
    trigger = re.fullmatch(r"(?:nếu|khi)\s+(?:user|khách|người dùng)\s+(?:nói|hỏi|nhập)\s+(.+)",
                           title.strip(), re.IGNORECASE)
    answer = re.fullmatch(r"trả\s+lời\s+(?:là|rằng)\s+(.+)", content.strip(), re.IGNORECASE | re.DOTALL)
    if not trigger or not answer:
        return None
    phrase = trigger.group(1).strip().strip('"\'“”‘’').rstrip('!?.').casefold()
    reply = answer.group(1).strip().strip('"\'“”‘’')
    return (re.sub(r"\s+", " ", phrase), reply) if phrase and reply else None


def find_exact_response_rule(question: str) -> dict | None:
    normalized = re.sub(r"\s+", " ", question.strip().strip('"\'“”‘’').rstrip('!?.').casefold())
    with connection() as db:
        rows = db.execute("SELECT id,title,content FROM knowledge_documents "
                          "WHERE status='INDEXED' AND is_active ORDER BY updated_at DESC").fetchall()
    for row in rows:
        parsed = response_rule(row["title"], row["content"])
        if parsed and parsed[0] == normalized:
            return {**row, "answer": parsed[1]}
    return None


DEFAULT_POLICIES = [
    {
        "id": UUID("00000000-0000-0000-0000-000000000001"),
        "title": "Chính sách đổi trả 7 ngày",
        "content": (
            "FashionHub hỗ trợ khách hàng đổi hàng trong vòng 7 ngày kể từ ngày nhận hàng thành công. "
            "Áp dụng cho mọi sản phẩm còn nguyên tem mác, chưa qua sử dụng, giặt ủi và có hóa đơn mua hàng. "
            "Khách hàng có thể đổi size, đổi màu hoặc đổi sang sản phẩm khác bằng hoặc cao hơn giá trị tại bất kỳ showroom nào "
            "trong hệ thống FashionHub trên toàn quốc hoặc gửi chuyển phát nhanh. Miễn phí đổi hàng nếu do lỗi sản xuất hoặc sai sót từ shop."
        ),
        "source_url": "/policies/returns",
        "image_url": "/images/policy-returns.svg",
    },
    {
        "id": UUID("00000000-0000-0000-0000-000000000002"),
        "title": "Chính sách giao hàng & Freeship từ 499k",
        "content": (
            "FashionHub áp dụng chính sách giao hàng toàn quốc nhanh chóng và tiện lợi: "
            "Miễn phí vận chuyển toàn quốc cho mọi đơn hàng có giá trị từ 499.000 VNĐ. "
            "Đơn hàng dưới 499.000 VNĐ áp dụng mức phí giao hàng đồng giá 30.000 VNĐ. "
            "Thời gian giao hàng dự kiến 1-2 ngày đối với nội thành Hà Nội & TP.HCM, 2-4 ngày đối với các tỉnh thành khác. "
            "Khách hàng được quyền kiểm tra hàng (đồng kiểm) trước khi thanh toán cho shipper."
        ),
        "source_url": "/policies/shipping",
        "image_url": "/images/policy-shipping.svg",
    },
    {
        "id": UUID("00000000-0000-0000-0000-000000000003"),
        "title": "Bảng hướng dẫn chọn size M - 3XL",
        "content": (
            "FashionHub cung cấp bảng quy đổi kích cỡ chuẩn theo vóc dáng người Việt Nam đầy đủ từ size M đến 3XL: "
            "Size M (1m55 - 1m65, 50kg - 60kg); Size L (1m65 - 1m72, 60kg - 68kg); "
            "Size XL (1m70 - 1m78, 68kg - 76kg); Size 2XL (1m75 - 1m85, 76kg - 85kg); "
            "Size 3XL (1m78 - 1m90, 85kg - 98kg). "
            "Nếu số đo của bạn nằm giữa hai kích cỡ, chúng tôi khuyến khích bạn chọn kích cỡ lớn hơn để có trải nghiệm mặc thoải mái nhất."
        ),
        "source_url": "/size-guide",
        "image_url": "/images/policy-size.svg",
    },
    {
        "id": UUID("00000000-0000-0000-0000-000000000004"),
        "title": "Hệ thống 10 Showroom FashionHub toàn quốc",
        "content": (
            "Hệ thống showroom FashionHub hiện có mặt tại 10 chi nhánh trọng điểm trên toàn quốc, tích hợp bản đồ chỉ đường Google Maps: "
            "Hà Nội (Vincom Bà Triệu, Aeon Mall Long Biên, 245 Cầu Giấy, Lotte Liễu Giai), "
            "TP. Hồ Chí Minh (Saigon Centre Q1, Vincom Đồng Khởi Q1, Crescent Mall Q7, Vạn Hạnh Mall Q10), "
            "Đà Nẵng (Vincom Plaza Ngô Quyền, 156 Nguyễn Văn Linh Hải Châu). Giờ mở cửa phục vụ: 9:00 - 22:00 tất cả các ngày trong tuần."
        ),
        "source_url": "/stores",
        "image_url": "/images/policy-stores.svg",
    },
    {
        "id": UUID("00000000-0000-0000-0000-000000000005"),
        "title": "Cam kết chính hãng & Hotline 1800 6000",
        "content": (
            "FashionHub cam kết 100% sản phẩm cung cấp là hàng chính hãng, chất lượng cao, đúng mô tả và hình ảnh chụp thực tế. "
            "Xuất hóa đơn VAT đầy đủ theo yêu cầu. Bảo mật tuyệt đối thông tin cá nhân khách hàng. "
            "Tổng đài chăm sóc khách hàng và tư vấn miễn phí cước gọi: 1800 6000 (8:00 - 21:30 hàng ngày). Email hỗ trợ: cskh@fashionhub.vn."
        ),
        "source_url": "/policies/terms",
        "image_url": "/images/policy-terms.svg",
    },
]


def resolve_source_meta(title: str) -> tuple[str, str]:
    t = title.lower()
    if any(k in t for k in ("đổi trả", "đổi hàng", "trả hàng", "returns")):
        return "/policies/returns", "/images/policy-returns.svg"
    if any(k in t for k in ("giao hàng", "vận chuyển", "freeship", "shipping")):
        return "/policies/shipping", "/images/policy-shipping.svg"
    if any(k in t for k in ("chọn size", "bảng size", "kích cỡ", "size")):
        return "/size-guide", "/images/policy-size.svg"
    if any(k in t for k in ("cửa hàng", "showroom", "chi nhánh", "stores", "bản đồ")):
        return "/stores", "/images/policy-stores.svg"
    if any(k in t for k in ("bảo mật", "privacy")):
        return "/policies/privacy", "/images/policy-terms.svg"
    return "/policies/terms", "/images/policy-terms.svg"


def find_matching_policies(question: str) -> list[dict]:
    q = question.lower()
    results = []
    # shipping
    if any(k in q for k in ("giao hàng", "vận chuyển", "freeship", "phí ship", "tiền ship", "ship", "bao lâu nhận", "đồng kiểm")):
        results.append({**DEFAULT_POLICIES[1], "score": 0.95})
    # returns
    if any(k in q for k in ("đổi trả", "đổi hàng", "trả hàng", "đổi size", "hoàn tiền", "7 ngày")):
        results.append({**DEFAULT_POLICIES[0], "score": 0.95})
    # size guide
    if any(k in q for k in ("chọn size", "bảng size", "tư vấn size", "cân nặng", "chiều cao", "mặc size gì", "size m", "size l", "size xl", "size 2xl", "size 3xl", "kích cỡ")):
        results.append({**DEFAULT_POLICIES[2], "score": 0.95})
    # stores
    if any(k in q for k in ("cửa hàng", "chi nhánh", "showroom", "địa chỉ", "bản đồ", "google map", "ở đâu", "hà nội", "hồ chí minh", "đà nẵng", "vincom")):
        results.append({**DEFAULT_POLICIES[3], "score": 0.95})
    # terms / hotline
    if any(k in q for k in ("chính hãng", "bảo hành", "hóa đơn", "hotline", "tổng đài", "liên hệ", "điều khoản", "uy tín", "sđt")):
        results.append({**DEFAULT_POLICIES[4], "score": 0.95})
    if not results:
        return []
    try:
        with connection() as db:
            rows = db.execute(
                "SELECT id,title,content FROM knowledge_documents "
                "WHERE id = ANY(%s) AND is_active AND status='INDEXED'",
                ([item["id"] for item in results],),
            ).fetchall()
        current = {row["id"]: row for row in rows}
        return [{**item, "title": current[item["id"]]["title"],
                 "content": current[item["id"]]["content"]}
                for item in results if item["id"] in current]
    except Exception:
        return []


def split_content(content: str, size: int = 800, overlap: int = 120) -> list[str]:
    clean = " ".join(content.split())
    if not clean:
        return []
    return [clean[start:start + size] for start in range(0, len(clean), size - overlap)]


def index_document(document_id: UUID, content: str) -> None:
    chunks = split_content(content)
    try:
        if not chunks:
            raise ValueError("Document content is empty")
        vectors = embed(chunks)
        if len(vectors) != len(chunks):
            raise ValueError("Embedding count mismatch")
        with connection() as db:
            current = db.execute("SELECT content FROM knowledge_documents WHERE id=%s", (document_id,)).fetchone()
            if current is None or current["content"] != content:
                return
            db.execute("DELETE FROM knowledge_chunks WHERE document_id=%s", (document_id,))
            for index, (chunk, vector) in enumerate(zip(chunks, vectors)):
                db.execute(
                    "INSERT INTO knowledge_chunks"
                    "(id,document_id,chunk_index,content,embedding_model,embedding)"
                    " VALUES (%s,%s,%s,%s,%s,%s)",
                    (uuid4(), document_id, index, chunk, EMBEDDING_INDEX_ID, vector),
                )
            db.execute(
                "UPDATE knowledge_documents SET status='INDEXED',last_error=NULL,indexed_at=now(),updated_at=now() WHERE id=%s",
                (document_id,),
            )
    except Exception as error:
        with connection() as db:
            db.execute(
                "UPDATE knowledge_documents SET status='FAILED',last_error=%s,updated_at=now() "
                "WHERE id=%s AND content=%s",
                (str(error)[:1000], document_id, content),
            )
        logger.exception("Knowledge indexing failed for %s", document_id)


def seed_default_policies() -> None:
    try:
        with connection() as db:
            for item in DEFAULT_POLICIES:
                db.execute(
                    "INSERT INTO knowledge_documents (id, title, content, status) "
                    "VALUES (%s, %s, %s, 'INDEXED') "
                    "ON CONFLICT (id) DO NOTHING",
                    (item["id"], item["title"], item["content"])
                )
    except Exception:
        pass


def index_missing_policies() -> None:
    ids = [item["id"] for item in DEFAULT_POLICIES]
    with connection() as db:
        rows = db.execute(
            "SELECT d.id,d.content FROM knowledge_documents d "
            "WHERE d.id=ANY(%s) AND (d.status<>'INDEXED' OR NOT EXISTS "
            "(SELECT 1 FROM knowledge_chunks c WHERE c.document_id=d.id AND c.embedding_model=%s))",
            (ids, EMBEDDING_INDEX_ID),
        ).fetchall()
    for row in rows:
        with connection() as db:
            db.execute("UPDATE knowledge_documents SET status='PENDING',last_error=NULL WHERE id=%s",
                       (row["id"],))
        index_document(row["id"], row["content"])


def retrieve(question: str, limit: int = 4) -> list[dict]:
    matches = find_matching_policies(question)
    try:
        with connection() as db:
            rows = db.execute(
                "SELECT c.id,c.document_id,d.title,d.content AS document_content,c.content,c.embedding "
                "FROM knowledge_chunks c JOIN knowledge_documents d ON d.id=c.document_id "
                "WHERE d.status='INDEXED' AND d.is_active AND c.embedding_model=%s",
                (EMBEDDING_INDEX_ID,),
            ).fetchall()
        if rows:
            query_vector = embed([question])[0]
            ranked = []
            query_norm = math.sqrt(sum(value * value for value in query_vector))
            for row in rows:
                if response_rule(row["title"], row["document_content"]):
                    continue
                vector = row["embedding"]
                if len(vector) != len(query_vector):
                    continue
                norm = math.sqrt(sum(value * value for value in vector))
                score = sum(a * b for a, b in zip(query_vector, vector)) / (norm * query_norm) if norm and query_norm else 0
                if score > 0.2:
                    url, img = resolve_source_meta(row["title"])
                    ranked.append({**row, "source_url": url, "image_url": img, "score": max(0.0, min(1.0, score))})
            ranked_sorted = sorted(ranked, key=lambda row: row["score"], reverse=True)
            combined = []
            seen_documents = set()
            for row in [*matches, *ranked_sorted]:
                document_id = row.get("document_id") or row.get("id")
                if document_id in seen_documents:
                    continue
                seen_documents.add(document_id)
                combined.append(row)
                if len(combined) == limit:
                    break
            if combined:
                return combined
    except Exception:
        pass
    return matches[:limit]
