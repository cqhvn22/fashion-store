# Các bước xây dựng và kiểm chứng AI RAG

Tài liệu mô tả hệ thống đang chạy ngày 15/11/2026. Lệnh PowerShell chạy tại thư mục gốc project. Xem [đánh giá và giới hạn](ai-rag-audit.md).

## 1. Chuẩn bị dữ liệu

- `ai-service/atino_products.xlsx`: file dùng để nhập dữ liệu ATINO ban đầu vào Catalog DB; không được đọc trong luồng AI đang chạy.
- Catalog nội bộ `/api/v1/internal/ai-products`: nguồn sản phẩm duy nhất của chỉ mục AI, đọc từ Catalog DB.
- `knowledge_documents`: tài liệu/chính sách do admin quản lý. Quy tắc “Nếu user nói… / Trả lời là…” là luồng phản hồi chính xác riêng.

`app/ingestion/workbook.py` phục vụ bước nhập ban đầu. Mọi cập nhật về sản phẩm sau đó thực hiện trong Catalog DB qua giao diện/API quản trị; AI đồng bộ từ feed Catalog.

## 2. Cấu hình provider

Đặt trong `.env` ở gốc project:

```dotenv
AI_PROVIDER=openrouter
AI_CHAT_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
OPENROUTER_API_KEY=<khóa của bạn>
AI_EMBEDDING_MODEL=qwen3-embedding:0.6b
```

Model trên là cấu hình đã kiểm tra, có thể thay bằng model OpenRouter khác. Không đưa khóa thật vào Git. Không tự chuyển model dự phòng: khi model chọn lỗi, API trả 503. Embedding chạy qua Ollama, độc lập với OpenRouter.

## 3. Khởi động và lập chỉ mục

```powershell
pwsh -File scripts/setup/start-ollama-rag.ps1
docker compose -p fashion-codex --env-file .env -f infrastructure/docker/compose.yaml up -d --build
docker compose -p fashion-codex --env-file .env -f infrastructure/docker/compose.yaml ps
```

AI service chạy migration trong `ai-service/migrations`. `product_documents` lưu nội dung, hash, model embedding và vector; `knowledge_documents`/`knowledge_chunks` lưu tài liệu và các đoạn. `sync_all()` cập nhật theo ID/hash và xóa mục không còn trong snapshot nguồn xử lý thành công. Đồng bộ mặc định mỗi 90 giây.

Admin bấm **Cập nhật tri thức sản phẩm** (`POST /api/v1/admin/ai/reindex`), xem `GET /api/v1/admin/ai/index-status`; các API yêu cầu JWT ADMIN. Tài liệu admin có thao tác thêm, sửa, ẩn/xóa và lập lại chỉ mục. `/health` chỉ báo tình trạng cơ bản; xác nhận số mục và lỗi trong trang quản trị.

## 4. Luồng câu hỏi

1. Frontend gửi `POST /api/v1/chat` qua Gateway.
2. Quy tắc chính xác do admin đặt được kiểm tra trước, trả `answerOrigin=RULE`.
3. Câu hỏi sản phẩm được lọc theo giá, size, màu, loại và tình trạng; xếp hạng từ khóa + cosine. Không có kết quả trả `NO_RESULTS`.
4. Tài liệu đang bật và sản phẩm liên quan đưa vào prompt với mã `[TL1]` / `[SP1]`; dữ liệu truy xuất không được coi là chỉ thị cho model.
5. OpenRouter gọi đúng `AI_CHAT_MODEL`; API trả `answerOrigin=MODEL`, `provider`, `requestedModel` và danh sách nguồn. Lỗi provider trả 503.
6. Phản hồi và nguồn được lưu vào DB; provider/model từng lượt chưa được lưu lâu dài.

## 5. Kiểm thử

```powershell
docker compose -p fashion-codex --env-file .env -f infrastructure/docker/compose.yaml exec ai-service python -m eval.retrieval
docker run --rm -v "${PWD}/ai-service/tests:/app/tests:ro" fashion-codex-ai-service python -m unittest discover -s tests -v
```

Bộ `ai-service/eval/retrieval_cases.json` kiểm tra top 5, câu hỏi tự nhiên có ràng buộc và câu không có kết quả. Trên giao diện, hỏi câu thật và đối chiếu `answerOrigin=MODEL`, `[SP/TL]`, giá và link với Catalog. Thử thiếu dữ liệu, provider lỗi, sửa/ẩn tài liệu và cập nhật sản phẩm. Mở rộng bộ nhãn từ câu hỏi người dùng, đo groundedness, p95 và lỗi theo [Microsoft RAG evaluators](https://learn.microsoft.com/en-us/azure/foundry/concepts/evaluation-evaluators/rag-evaluators).

## 6. Hướng mở rộng

Benchmark rồi cân nhắc pgvector/HNSW khi corpus tăng. Lưu trạng thái đồng bộ vào DB/queue bền vững; ghi request ID, model trả về thực tế, số nguồn và thời gian xử lý mà không log khóa/dữ liệu cá nhân. Thử prompt injection theo [OWASP LLM01](https://genai.owasp.org/llmrisk/llm01-prompt-injection/). Kiểm chứng sản phẩm đã gỡ khỏi Catalog cũng biến mất khỏi chỉ mục AI.
