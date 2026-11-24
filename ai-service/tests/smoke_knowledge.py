"""Run inside the AI container to exercise the admin knowledge API end to end."""

import os
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import jwt


token = jwt.encode(
    {"sub": str(uuid4()), "iss": "fashion-auth",
     "exp": datetime.now(timezone.utc) + timedelta(minutes=5), "groups": ["ADMIN"]},
    os.environ["JWT_SECRET"], algorithm="HS256",
)
client = httpx.Client(base_url="http://127.0.0.1:8000", timeout=30,
                      headers={"Authorization": f"Bearer {token}"})
document_id = None
try:
    response = client.post("/api/v1/admin/knowledge", json={
        "title": "Tài liệu thử nghiệm tạm thời",
        "content": "Nội dung kiểm thử thao tác quản lý tri thức AI, không dùng để tư vấn khách hàng.",
    })
    assert response.status_code == 200, response.text
    document_id = response.json()["data"]["id"]

    response = client.put(f"/api/v1/admin/knowledge/{document_id}", json={
        "title": "Tài liệu thử nghiệm đã sửa",
        "content": "Nội dung mới kiểm thử cập nhật tài liệu và lập chỉ mục lại.",
    })
    assert response.status_code == 200, response.text
    assert response.json()["data"]["title"] == "Tài liệu thử nghiệm đã sửa"

    response = client.patch(f"/api/v1/admin/knowledge/{document_id}/active",
                            json={"isActive": False})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["isActive"] is False

    response = client.post(f"/api/v1/admin/knowledge/{document_id}/reindex")
    assert response.status_code == 202, response.text

    response = client.get("/api/v1/admin/knowledge", params={"q": "đã sửa"})
    assert response.status_code == 200, response.text
    assert any(item["id"] == document_id for item in response.json()["data"])
    print("Knowledge API create/update/visibility/reindex/search: OK")
finally:
    if document_id:
        response = client.delete(f"/api/v1/admin/knowledge/{document_id}")
        assert response.status_code == 200, response.text
    client.close()
