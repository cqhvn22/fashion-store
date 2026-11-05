# Fashion Microservices

Thư mục này là gốc project. Frontend React/Vite hiện có được giữ nguyên.
Backend hiện là khung Spring Boot; các API nghiệp vụ chưa được triển khai.

## Yêu cầu

- Java 21, Maven 3.9+, Node.js 20+, Python 3.11+; Docker Compose nếu chạy bằng container.
- Spring Boot 3.5.16 và Spring Cloud 2025.0.3.

## Chạy thử

- Frontend: `cd frontend && npm ci && npm run dev`
- Build backend: `mvn -f backend/pom.xml verify`
- Chạy từng service: `mvn -f backend/<service>/pom.xml spring-boot:run`
- AI service: cài `ai-service/requirements.txt`, rồi chạy `uvicorn app.main:app --app-dir ai-service --port 8000`
- Docker: `docker compose -f infrastructure/docker/compose.yaml up --build`
- Thêm PostgreSQL, MongoDB, Kafka: thêm `-f infrastructure/docker/compose.dev.yaml`

Frontend đang bật mock. Backend hiện có health check và gateway routes, chưa có API nghiệp vụ, database, xác thực hoặc messaging. Xem `frontend/API_CONTRACT.md` trước khi chuyển sang API thật.

| Service | Port |
| --- | ---: |
| API gateway | 8080 |
| Auth | 8081 |
| Catalog | 8082 |
| Order | 8083 |
| Notification | 8084 |
| AI | 8000 |
| Frontend Docker | 3000 |
