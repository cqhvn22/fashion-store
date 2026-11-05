.PHONY: backend-test frontend-test frontend-build up down
backend-test:
	mvn -f backend/pom.xml verify
frontend-test:
	cd frontend && npm test
frontend-build:
	cd frontend && npm run build
up:
	docker compose -f infrastructure/docker/compose.yaml up --build
down:
	docker compose -f infrastructure/docker/compose.yaml down
