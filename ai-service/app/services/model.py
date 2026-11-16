import hashlib
import json
import logging
import math
import os
import re
import time
import httpx
from fastapi import HTTPException

from app.services.prompt import SYSTEM_PROMPT

from app.core.settings import (
    AI_API_BASE_URL, AI_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, AI_EMBEDDING_MODEL, AI_CHAT_MODEL,
    AI_PROVIDER, OLLAMA_BASE_URL,
)

logger = logging.getLogger(__name__)


def get_ollama_url() -> str:
    return OLLAMA_BASE_URL


def get_chat_model(base_url: str | None = None) -> str:
    configured = os.environ.get("AI_CHAT_MODEL", AI_CHAT_MODEL)
    return configured


def request(path: str, payload: dict) -> dict:
    if not AI_API_KEY:
        raise HTTPException(status_code=503, detail="AI_API_KEY is not configured")
    try:
        with httpx.Client(timeout=30) as client:
            response = client.post(
                f"{AI_API_BASE_URL}{path}", json=payload,
                headers={"Authorization": f"Bearer {AI_API_KEY}"}
            )
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError) as error:
        raise HTTPException(status_code=502, detail="AI provider unavailable") from error


def deterministic_embed(text: str, dim: int = 1024) -> list[float]:
    vec = [0.0] * dim
    words = re.findall(r"\w+", text.lower())
    if not words:
        return [0.0] * dim
    for word in words:
        digest = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
        bucket = digest % dim
        sign = 1.0 if ((digest >> 8) & 1) else -1.0
        vec[bucket] += sign
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    return vec


def embed(texts: list[str], keep_alive: int | str = 0) -> list[list[float]]:
    base_url = get_ollama_url()
    try:
        with httpx.Client(timeout=120) as client:
            response = client.post(
                f"{base_url}/api/embed",
                json={"model": AI_EMBEDDING_MODEL, "input": texts, "keep_alive": keep_alive},
            )
            if response.status_code == 200:
                vectors = response.json().get("embeddings")
                if vectors and len(vectors) == len(texts) and all(vector for vector in vectors):
                    return vectors
    except Exception as error:
        logger.warning("Embedding endpoint unavailable: %s", error)
    raise HTTPException(status_code=503, detail="Embedding model unavailable")


def call_gemini(
    model: str = "gemini-1.5-flash",
    system_prompt: str = SYSTEM_PROMPT,
    messages: list[dict] | None = None,
    system_instruction: str = "",
) -> str:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("AI_API_KEY") or GEMINI_API_KEY
    if not key:
        return ""

    clean_model = model.strip()
    target_models = [clean_model or "gemini-flash-latest"]

    full_system = system_prompt
    if system_instruction:
        full_system += f"\n\nCHỈ DẪN TRỌNG TÂM CHO LƯỢT NÀY:\n{system_instruction}"

    # Build contents for Gemini Native API with strict role alternation
    contents = []
    last_role = None
    for msg in (messages or []):
        role = msg.get("role", "user")
        if role == "system":
            continue
        g_role = "user" if role in ("user", "human") else "model"
        text_content = (msg.get("content") or "").strip()
        if not text_content:
            continue
        if g_role == last_role and contents:
            # Merge consecutive turns of same role
            contents[-1]["parts"][0]["text"] += f"\n\n{text_content}"
        else:
            contents.append({
                "role": g_role,
                "parts": [{"text": text_content}]
            })
            last_role = g_role

    # Gemini requires first turn to be 'user'
    while contents and contents[0]["role"] != "user":
        contents.pop(0)

    if not contents:
        return ""

    # Strategy 1: Google Native Generative Language API
    for m in target_models:
        native_url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key}"
        gen_config: dict = {
            "temperature": 0.4,
            "maxOutputTokens": 2048,
        }
        if "2.5" in m:
            gen_config["thinkingConfig"] = {"thinkingBudget": 0}

        payload = {
            "system_instruction": {
                "parts": [{"text": full_system}]
            },
            "contents": contents,
            "generationConfig": gen_config,
        }
        try:
            with httpx.Client(timeout=25) as client:
                res = client.post(native_url, json=payload)
                if res.status_code in (429, 500, 502, 503):
                    time.sleep(2)
                    res = client.post(native_url, json=payload)
                if res.status_code == 400 and "thinkingConfig" in gen_config:
                    # Retry without thinkingConfig if rejected by older/lite endpoints
                    gen_config.pop("thinkingConfig", None)
                    payload["generationConfig"] = gen_config
                    res = client.post(native_url, json=payload)

                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts and parts[0].get("text"):
                            return parts[0]["text"].strip()
                else:
                    logger.warning("Gemini native %s HTTP %s: %s", m, res.status_code, res.text[:200])
        except Exception as error:
            logger.warning("Gemini native %s error: %s", m, error)

    # Strategy 2: Google OpenAI-compatible endpoint
    openai_url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    headers = {"Authorization": f"Bearer {key}"}
    for m in target_models:
        chat_messages = [{"role": "system", "content": full_system}]
        for msg in (messages or []):
            if msg.get("role") != "system":
                chat_messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        try:
            with httpx.Client(timeout=25) as client:
                res = client.post(openai_url, json={
                    "model": m,
                    "messages": chat_messages,
                    "temperature": 0.4,
                }, headers=headers)
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"].strip()
                else:
                    logger.warning("Gemini OpenAI %s HTTP %s: %s", m, res.status_code, res.text[:200])
        except Exception as error:
            logger.warning("Gemini OpenAI-compatible %s error: %s", m, error)

    return ""


def call_openrouter(
    model: str = "nvidia/nemotron-3-ultra-550b-a55b:free",
    system_prompt: str = SYSTEM_PROMPT,
    messages: list[dict] | None = None,
    system_instruction: str = "",
) -> str:
    key = os.environ.get("OPENROUTER_API_KEY") or OPENROUTER_API_KEY
    if not key:
        return ""

    full_system = system_prompt
    if system_instruction:
        full_system += f"\n\nCHỈ DẪN TRỌNG TÂM CHO LƯỢT NÀY:\n{system_instruction}"

    chat_messages = [{"role": "system", "content": full_system}]
    for msg in (messages or []):
        if msg.get("role") != "system":
            chat_messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})

    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "FashionHub",
    }

    configured_model = model.strip()
    if not configured_model:
        return ""

    for attempt in range(2):
        payload = {
            "model": configured_model,
            "messages": chat_messages,
            "temperature": 0.4,
        }
        try:
            with httpx.Client(timeout=35) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices:
                        content = choices[0].get("message", {}).get("content", "")
                        if content:
                            returned_model = data.get("model", configured_model)
                            logger.info("OpenRouter answered with model=%s", returned_model)
                            return content.strip()
                logger.warning("OpenRouter model=%s status=%s", configured_model, res.status_code)
                if res.status_code not in (429, 500, 502, 503):
                    break
        except Exception as error:
            logger.warning("OpenRouter model=%s request failed: %s", configured_model, type(error).__name__)
        if attempt == 0:
            time.sleep(2)

    return ""


def generate_ai_chat(
    question: str,
    history: list[dict],
    knowledge_context: list[str],
    product_context: list[dict],
    is_off_topic: bool = False,
    is_greeting: bool = False,
    system_instruction: str = "",
    fallback_text: str = "",
    customer_context: str = "",
) -> str:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    if system_instruction:
        messages.append({"role": "system", "content": f"CHỈ DẪN TRỌNG TÂM: {system_instruction}"})
    if customer_context:
        messages.append({"role": "system", "content": customer_context})
    effective_instruction = "\n".join(part for part in (system_instruction, customer_context) if part)

    # Append recent conversation history for multi-turn context
    for msg in history[-6:]:
        role = msg.get("role", "user")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": msg.get("content", "")})

    # Prepare user content with RAG context
    context_parts = []
    if knowledge_context:
        sources = "\n".join(
            f"[TL{index}] {content[:1800]}"
            for index, content in enumerate(knowledge_context[:4], 1)
        )
        context_parts.append("<nguon_tri_thuc>\n" + sources + "\n</nguon_tri_thuc>")
    if product_candidates := product_context:
        prod_lines = []
        for index, p in enumerate(product_candidates[:5], 1):
            p_desc = f"[SP{index}] Tên: {p['name']} | Giá bán: {p['price']:,} đ".replace(",", ".")
            if p.get("original_price") and int(p["original_price"]) > int(p["price"]):
                p_desc += f" | Giá gốc: {int(p['original_price']):,} đ".replace(",", ".")
            if p.get("promotion"):
                p_desc += f" | Khuyến mãi: {p['promotion']}"
            if p.get("colors"):
                p_desc += f" | Màu: {', '.join(p['colors'][:4])}"
            if p.get("sizes"):
                p_desc += f" | Size: {', '.join(p['sizes'][:6])}"
            if p.get("material"):
                p_desc += f" | Chất liệu: {p['material']}"
            prod_lines.append(p_desc)
        context_parts.append("<nguon_san_pham>\n" + "\n".join(prod_lines) + "\n</nguon_san_pham>")

        # Ensure model is strictly reminded to output '- Giá bán: ...'
        if not effective_instruction or "giá bán" not in effective_instruction.lower():
            prod_rule = (
                "BẮT BUỘC: Khi gợi ý sản phẩm, mỗi sản phẩm PHẢI có dòng '- Giá bán: ... đ' "
                "theo đúng cấu trúc:\n"
                "1. **[Tên sản phẩm]**\n"
                "- Giá bán: [Giá] đ\n"
                "- Màu sắc: [Màu]\n"
                "- Kích cỡ: [Size]\n"
                "- Điểm nổi bật: [Mô tả ngắn gọn]"
            )
            effective_instruction = f"{effective_instruction}\n\n{prod_rule}".strip() if effective_instruction else prod_rule

    user_payload = ""
    if context_parts:
        user_payload += "\n\n".join(context_parts) + "\n\n"
    user_payload += f"Câu hỏi của khách hàng: {question}"

    messages.append({"role": "user", "content": user_payload})

    if AI_PROVIDER == "openrouter":
        target_model = AI_CHAT_MODEL or "nvidia/nemotron-3-ultra-550b-a55b:free"
        openrouter_reply = call_openrouter(
            model=target_model,
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            system_instruction=effective_instruction,
        )
        if openrouter_reply:
            return openrouter_reply
        if fallback_text:
            return fallback_text
        raise HTTPException(
            status_code=503,
            detail="Trợ lý AI đang bận, chưa thể trả lời lúc này. Vui lòng thử lại sau.",
        )

    # Gemini is retained for deployments that explicitly select it.
    is_gemini_requested = AI_PROVIDER == "gemini"

    if is_gemini_requested:
        target_model = AI_CHAT_MODEL if "gemini" in AI_CHAT_MODEL.lower() else "gemini-flash-latest"
        gemini_reply = call_gemini(
            model=target_model,
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            system_instruction=effective_instruction,
        )
        if gemini_reply:
            return gemini_reply
        raise HTTPException(
            status_code=503,
            detail="Trợ lý AI đang bận, chưa thể trả lời lúc này. Vui lòng thử lại sau.",
        )

    if AI_PROVIDER == "ollama":
        base_url = get_ollama_url()
        model_name = get_chat_model(base_url)
        try:
            with httpx.Client(timeout=120) as client:
                response = client.post(
                    f"{base_url}/api/chat",
                    json={
                        "model": model_name,
                        "messages": messages,
                        "stream": False,
                        "keep_alive": 0,
                        "options": {
                            "temperature": 0.4,
                            "top_p": 0.9,
                            "repeat_penalty": 1.15,
                            "num_predict": 450,
                            "num_ctx": 4096,
                        },
                    },
                )
                response.raise_for_status()
                content = response.json().get("message", {}).get("content", "").strip()
                if content:
                    return content
        except Exception as error:
            logger.warning("Ollama /api/chat error (%s)", type(error).__name__)

    raise HTTPException(status_code=503, detail="Trợ lý AI chưa sẵn sàng. Vui lòng thử lại sau.")


def choose_products(question: str, candidates: list[dict]) -> list[dict]:
    if not candidates:
        return []
    count_match = re.search(r"(?:gợi ý|tư vấn|cho tôi)\s*(\d{1,2})", question.lower())
    target = min(3, max(1, int(count_match.group(1)))) if count_match else 3
    if AI_PROVIDER != "ollama":
        return candidates[:target]
    options = [{"id": str(row["id"]), "name": row["name"],
                "category": row["category"], "price": row["price"],
                "colors": row.get("colors", []), "sizes": row.get("sizes", [])}
               for row in candidates]
    base_url = get_ollama_url()
    model_name = get_chat_model(base_url)
    try:
        with httpx.Client(timeout=30) as client:
            response = client.post(f"{base_url}/api/chat", json={
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "Chọn tối đa 3 ID sản phẩm phù hợp nhất với yêu cầu. "
                     "Chỉ chọn ID trong danh sách. Trả duy nhất JSON dạng "
                     "{\"ids\":[\"id1\",\"id2\"]}, không viết giải thích."},
                    {"role": "user", "content": json.dumps({"question": question, "candidates": options},
                                                      ensure_ascii=False)},
                ],
                "format": "json", "stream": False, "keep_alive": 0,
                "options": {"temperature": 0, "num_predict": 160, "num_ctx": 4096},
            })
            if response.status_code == 200:
                selected = json.loads(response.json()["message"]["content"]).get("ids", [])
                allowed = {str(row["id"]): row for row in candidates}
                result = [allowed[str(item)] for item in selected if str(item) in allowed]
                if result:
                    return result[:target]
    except Exception:
        pass
    return candidates[:target]
