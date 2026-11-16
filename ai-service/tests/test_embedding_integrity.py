import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.services.model import embed, get_ollama_url
from app.core.settings import OLLAMA_BASE_URL


class EmbeddingIntegrityTests(unittest.TestCase):
    def test_uses_configured_ollama_instance(self):
        self.assertEqual(get_ollama_url(), OLLAMA_BASE_URL)

    @patch("app.services.model.httpx.Client", side_effect=ConnectionError("Ollama offline"))
    def test_embedding_failure_does_not_create_fake_vectors(self, _client):
        with self.assertRaises(HTTPException) as caught:
            embed(["áo sơ mi"])
        self.assertEqual(caught.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
