from pathlib import Path

import psycopg
from psycopg.rows import dict_row

from app.core.settings import DATABASE_URL


def connection():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)


def migrate() -> None:
    migrations = Path(__file__).resolve().parents[2] / "migrations"
    with connection() as db:
        db.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations "
            "(version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
        )
        for version, migration in (
            (1, "V1__initial_schema.sql"),
            (2, "V2__product_documents.sql"),
            (3, "V3__chat_source_image_url.sql"),
            (4, "V4__knowledge_management.sql"),
            (5, "V5__catalog_only_product_knowledge.sql"),
        ):
            exists = db.execute("SELECT 1 FROM schema_migrations WHERE version=%s", (version,)).fetchone()
            if exists is None:
                db.execute((migrations / migration).read_text(encoding="utf-8"))
                db.execute("INSERT INTO schema_migrations(version) VALUES (%s)", (version,))
