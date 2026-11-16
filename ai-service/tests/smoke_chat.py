"""Run inside the AI container to check a product answer with RAG sources."""

from uuid import uuid4

import httpx

from app.core.db import connection


conversation_id = uuid4()
try:
    response = httpx.post("http://127.0.0.1:8000/api/v1/chat", timeout=180, json={
        "conversationId": str(conversation_id),
        "message": "Gợi ý áo phông nam dưới 300.000 đồng",
    })
    assert response.status_code == 200, response.text
    data = response.json()["data"]
    assert data["content"].strip()
    assert data["sources"], "No RAG sources were returned"
    print("Product chat: OK; sources:", len(data["sources"]))
finally:
    with connection() as db:
        db.execute("DELETE FROM conversations WHERE id=%s", (conversation_id,))
