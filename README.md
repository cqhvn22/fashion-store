# Fashion Microservices

Thư mục này là gốc project. Frontend React/Vite hiện có được giữ nguyên.
Backend hiện là khung Quarkus; các API nghiệp vụ chưa được triển khai.

## Yêu cầu

- Java 21, Maven 3.9.16+, Node.js 20+, Python 3.11+; Docker Compose nếu chạy bằng container.
- Quarkus 3.40.1.1 LTS cho năm module Java.

## Chạy thử

- Frontend: `cd frontend && npm ci && npm run dev`
- Build backend: `mvn -f backend/pom.xml verify`
- Chạy từng service: `mvn -f backend/<service>/pom.xml quarkus:dev`
- AI service: cài `ai-service/requirements.txt`, rồi chạy `uvicorn app.main:app --app-dir ai-service --port 8000`
- Docker: `docker compose -f infrastructure/docker/compose.yaml up --build`
- Thêm PostgreSQL, MongoDB, Kafka: thêm `-f infrastructure/docker/compose.dev.yaml`

Frontend đang bật mock. Các service Quarkus có health check tại `/q/health`; gateway chuyển tiếp các đường dẫn `/api/v1` sang service tương ứng. Backend chưa có API nghiệp vụ, database, xác thực hoặc messaging. Xem `frontend/API_CONTRACT.md` trước khi chuyển sang API thật.

Biểu đồ use case tổng quát và phạm vi từng actor: [docs/uml/use-case-overview.md](docs/uml/use-case-overview.md).

Bản mô tả chức năng, kiến trúc và SQL CSDL theo service: [docs/architecture/system-description.md](docs/architecture/system-description.md).

| Service | Port |
| --- | ---: |
| API gateway | 8080 |
| Auth | 8081 |
| Catalog | 8082 |
| Order | 8083 |
| Notification | 8084 |
| AI | 8000 |
| Frontend Docker | 3000 |
