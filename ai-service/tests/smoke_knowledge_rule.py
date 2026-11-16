"""Run inside the AI container; remove test document and conversation afterward."""

import os
import time
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import jwt

from app.core.db import connection


conversation_id = uuid4()
document_id = None
token = jwt.encode({"sub": str(uuid4()), "iss": "fashion-auth",
                    "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
                    "groups": ["ADMIN"]}, os.environ["JWT_SECRET"], algorithm="HS256")
client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=40,
                      headers={"Authorization": f"Bearer {token}"})
try:
    response = client.post("/api/v1/admin/knowledge", json={
        "title": "Nếu user nói hello", "content": 'Trả lời là "Hello world"'})
    assert response.status_code == 200, response.text
    document_id = response.json()["data"]["id"]
    for _ in range(30):
        item = client.get(f"/api/v1/admin/knowledge/{document_id}").json()["data"]
        if item["status"] != "PENDING":
            break
        time.sleep(1)
    assert item["status"] == "INDEXED", item
    assert item["chunkCount"] > 0, item
    response = client.post("/api/v1/chat", json={
        "conversationId": str(conversation_id), "message": "hello"})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["content"] == "Hello world", response.text
    print("Exact hello rule: OK")
finally:
    if document_id:
        client.delete(f"/api/v1/admin/knowledge/{document_id}")
    with connection() as db:
        db.execute("DELETE FROM conversations WHERE id=%s", (conversation_id,))
    client.close()
