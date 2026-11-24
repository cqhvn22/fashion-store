import unittest
from unittest.mock import patch
from fastapi import HTTPException

from app.services.model import generate_ai_chat


class GeminiProviderTests(unittest.TestCase):
    @patch("app.services.model.AI_PROVIDER", "gemini")
    @patch("app.services.model.AI_CHAT_MODEL", "gemini-flash-latest")
    @patch("app.services.model.call_gemini", return_value="Gemini trả lời")
    @patch("app.services.model.get_ollama_url", side_effect=AssertionError("Ollama chat must not run"))
    def test_gemini_is_the_answer_model(self, _ollama, gemini):
        result = generate_ai_chat("Xin chào", [], [], [])
        self.assertEqual(result, "Gemini trả lời")
        self.assertEqual(gemini.call_args.kwargs["model"], "gemini-flash-latest")

    @patch("app.services.model.AI_PROVIDER", "gemini")
    @patch("app.services.model.AI_CHAT_MODEL", "gemini-flash-latest")
    @patch("app.services.model.AI_API_KEY", "")
    @patch("app.services.model.call_gemini", return_value="")
    @patch("app.services.model.get_ollama_url", side_effect=AssertionError("Ollama chat must not run"))
    def test_gemini_outage_does_not_switch_to_ollama(self, _ollama, _gemini):
        with self.assertRaises(HTTPException) as error:
            generate_ai_chat("Xin chào", [], [], [], fallback_text="Tạm thời chưa trả lời được")
        self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
