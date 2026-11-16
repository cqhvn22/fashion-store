import os

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://fashion:change-me@localhost:5432/fashion_ai")
JWT_SECRET = os.environ.get("JWT_SECRET", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
AI_API_BASE_URL = os.environ.get("AI_API_BASE_URL", "https://openrouter.ai/api/v1").rstrip("/")
AI_API_KEY = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("GEMINI_API_KEY") or os.environ.get("AI_API_KEY", "")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or AI_API_KEY
AI_PROVIDER = os.environ.get("AI_PROVIDER", "openrouter").lower()
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434").rstrip("/")
AI_EMBEDDING_MODEL = os.environ.get("AI_EMBEDDING_MODEL", "qwen3-embedding:0.6b")
AI_CHAT_MODEL = os.environ.get("AI_CHAT_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
CATALOG_SERVICE_URL = os.environ.get("CATALOG_SERVICE_URL", "http://catalog-service:8082").rstrip("/")
ORDER_SERVICE_URL = os.environ.get("ORDER_SERVICE_URL", "http://order-service:8083").rstrip("/")
INTERNAL_API_KEY = os.environ.get("INTERNAL_API_KEY", "")
WORKBOOK_PATH = os.environ.get("WORKBOOK_PATH", "/app/atino_products.xlsx")
PRODUCT_SYNC_SECONDS = int(os.environ.get("PRODUCT_SYNC_SECONDS", "90"))
