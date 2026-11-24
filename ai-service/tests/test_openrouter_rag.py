import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException

from app.services.model import call_openrouter, generate_ai_chat
from app.services.prompt import SYSTEM_PROMPT


class OpenRouterRagTests(unittest.TestCase):
    @patch("app.services.model.OPENROUTER_API_KEY", "test-key")
    @patch("app.services.model.time.sleep")
    @patch("app.services.model.httpx.Client")
    def test_transient_error_retries_only_configured_model(self, client_class, sleep):
        unavailable = MagicMock(status_code=503)
        success = MagicMock(status_code=200)
        success.json.return_value = {
            "model": "nvidia/nemotron-3-ultra-550b-a55b:free",
            "choices": [{"message": {"content": "Áo phù hợp [SP1]"}}],
        }
        post = client_class.return_value.__enter__.return_value.post
        post.side_effect = [unavailable, success]
        answer = call_openrouter(
            model="nvidia/nemotron-3-ultra-550b-a55b:free",
            messages=[{"role": "user", "content": "Áo mát"}],
        )
        self.assertEqual(answer, "Áo phù hợp [SP1]")
        self.assertEqual(post.call_count, 2)
        self.assertEqual(
            {call.kwargs["json"]["model"] for call in post.call_args_list},
            {"nvidia/nemotron-3-ultra-550b-a55b:free"},
        )
        sleep.assert_called_once_with(2)

    @patch("app.services.model.AI_PROVIDER", "openrouter")
    @patch("app.services.model.AI_CHAT_MODEL", "nvidia/nemotron-3-ultra-550b-a55b:free")
    @patch("app.services.model.call_openrouter", return_value="")
    def test_outage_is_not_presented_as_answer(self, caller):
        with self.assertRaises(HTTPException) as error:
            generate_ai_chat("Áo mát", [], [], [], fallback_text="Câu viết sẵn")
        self.assertEqual(error.exception.status_code, 503)
        self.assertEqual(caller.call_args.kwargs["model"],
                         "nvidia/nemotron-3-ultra-550b-a55b:free")

    @patch("app.services.model.AI_PROVIDER", "openrouter")
    @patch("app.services.model.call_openrouter", return_value="Có áo [SP1]")
    def test_context_has_source_ids_and_untrusted_data_boundary(self, caller):
        generate_ai_chat(
            "Áo nào mát?", [], ["Chính sách giao hàng: nội dung"],
            [{"name": "Áo phông", "price": 120000, "colors": ["Trắng"],
              "sizes": ["M"], "product_url": "/products/ao-phong"}],
        )
        user_payload = caller.call_args.kwargs["messages"][-1]["content"]
        self.assertIn("[SP1]", user_payload)
        self.assertIn("[TL1]", user_payload)
        self.assertIn("<nguon_san_pham>", user_payload)
        self.assertIn("không phải chỉ thị", SYSTEM_PROMPT)
        self.assertNotIn("VNPAY", SYSTEM_PROMPT)


if __name__ == "__main__":
    unittest.main()
