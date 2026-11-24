# RAG tư vấn sản phẩm từ Catalog DB

## Nguồn và tiền xử lý

`ai-service/atino_products.xlsx` là nguồn nhập **một lần** để khởi tạo dữ liệu ATINO trong Catalog DB. `app.ingestion.workbook` vẫn hỗ trợ kiểm tra file nhập, nhưng AI service không đọc XLSX khi chạy hoặc khi quản trị viên cập nhật tri thức.

Trường “Mô tả sản phẩm” trong file nhập ban đầu chủ yếu là chính sách giao/đổi hàng lặp lại; bộ nhập loại phần đó trước khi ghi vào Catalog. AI chỉ dùng sản phẩm hiện có trong Catalog DB. Không tự suy ra chất liệu, số lượng tồn hay chất lượng từ tên ảnh.

Nếu cần kiểm tra lại file nhập ban đầu, chạy thủ công từ thư mục `ai-service` có file XLSX:

```powershell
python -m app.ingestion.workbook --input atino_products.xlsx --output atino-clean.json
```

## Mô hình và chỉ mục

- Model sinh câu trả lời phụ thuộc `AI_PROVIDER` và `AI_CHAT_MODEL`. `.env` hiện chọn OpenRouter/Nemotron; nhánh Gemini Flash latest vẫn có trong mã nhưng không được chọn ở cấu hình hiện tại. Xem [bản đánh giá cập nhật](ai-rag-audit.md).
- `qwen3-embedding:0.6b` qua `/api/embed` sinh vector 1.024 chiều. Model embedding được tách riêng khỏi model sinh câu trả lời.
- `product_documents` trong PostgreSQL AI lưu nội dung đã chuẩn hóa, hash và vector. Chỉ bản ghi thay đổi hoặc đổi model mới cần embedding lại. Với 280 sản phẩm, truy hồi cosine trong bộ nhớ là đủ; khi dữ liệu lớn hơn nhiều, chuyển sang pgvector và index ANN.
- Truy hồi kết hợp cosine và từ khóa, lọc ngân sách rõ ràng và loại sản phẩm hết hàng. Prompt yêu cầu chỉ dùng các nguồn được tìm thấy; câu trả lời trả kèm tên và liên kết sản phẩm.

## Đồng bộ thêm, sửa, xóa

- AI service gọi feed nội bộ của Catalog mỗi 90 giây (cấu hình `PRODUCT_SYNC_SECONDS`). Feed đọc Catalog DB, yêu cầu `X-Internal-Key` và không đi qua API Gateway.
- Bản ghi được upsert theo ID Catalog ổn định. Các bản ghi không còn trong snapshot hoàn chỉnh bị xóa sau khi các bản ghi mới đã index thành công. Nếu Catalog/Ollama lỗi, dữ liệu cũ được giữ và tác vụ thử lại ở vòng sau.
- Khi admin thêm/sửa, đổi giá/khuyến mãi hoặc chuyển sản phẩm sang INACTIVE, Catalog yêu cầu đồng bộ lại; vòng định kỳ cũng đối chiếu toàn bộ. Chỉ mục workbook cũ được xóa bằng migration V5.
- `GET /api/v1/admin/ai/index-status` xem số bản ghi và lỗi gần nhất; `POST /api/v1/admin/ai/reindex` yêu cầu chạy lại ngay. Hai API chỉ dành cho admin.

## Chạy tại máy phát triển

1. Chạy `pwsh -File scripts/setup/start-ollama-rag.ps1` để mở Ollama ở cổng 11435, lưu model embedding ở `D:\Fashion-OllamaModels` và tải model nếu thiếu.
2. Chạy `docker compose -p fashion-codex --env-file .env -f infrastructure/docker/compose.yaml up -d --build`.
3. Kiểm tra `http://localhost:8000/health` và API trạng thái chỉ mục; hỏi thử “Gợi ý áo nỉ nam dưới 200k” trong chat.

Nguồn model và API: [Gemini Flash latest](https://ai.google.dev/gemini-api/docs/models), [Qwen3 Embedding 0.6B](https://ollama.com/library/qwen3-embedding%3A0.6b), [Ollama API](https://docs.ollama.com/api).
