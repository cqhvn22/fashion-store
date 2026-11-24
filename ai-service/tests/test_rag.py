import json
import unittest
from unittest.mock import MagicMock, patch

from app.services.model import choose_products
from app.services.products import (_budget, _requested_color, _requested_size,
                                   _requested_types, document_text, sync_all, sync_status)


class ProductIndexTests(unittest.TestCase):
    def test_catalog_product_text(self):
        text = document_text({"name": "Áo khoác", "category": "Áo nam", "price": 200000,
                              "source": "catalog", "in_stock": True})
        self.assertIn("Giá: 200,000 VNĐ", text)
        self.assertIn("Tình trạng: còn hàng", text)

    @patch("app.services.products.replace_source")
    @patch("app.services.products.catalog_records")
    def test_sync_reads_catalog_only(self, records, replace):
        records.return_value = [{"source": "catalog", "source_id": "1"}]
        replace.return_value = {"total": 1, "indexed": 0, "deleted": 0}
        result = sync_all()
        replace.assert_called_once_with("catalog", records.return_value)
        self.assertNotIn("workbook", result)
        self.assertIsNone(result["error"])
        self.assertEqual(result["catalog"]["total"], 1)

    @patch("app.services.products.catalog_records", side_effect=RuntimeError("unavailable"))
    def test_failed_sync_keeps_last_success_time(self, _records):
        previous = sync_status["last_sync"]
        result = sync_all()
        self.assertEqual(result["last_sync"], previous)
        self.assertIn("catalog: unavailable", result["error"])

    def test_budget_units(self):
        self.assertEqual(_budget("áo nỉ dưới 200k"), 200_000)
        self.assertEqual(_budget("áo dưới 200.000đ"), 200_000)
        self.assertEqual(_budget("quần không quá 1 triệu"), 1_000_000)
        self.assertEqual(_requested_size("áo màu đen size M"), "M")
        self.assertEqual(_requested_color("áo màu đen size M", [{"colors": ["Trắng", "Đen"]}]), "đen")
        self.assertEqual(_requested_types("áo màu đen size M"), ["áo"])


class ModelTests(unittest.TestCase):
    @patch("app.services.model.AI_PROVIDER", "ollama")
    @patch("app.services.model.httpx.Client")
    def test_qwen_selection_cannot_invent_product(self, client_class):
        candidates = [{"id": "one", "name": "Áo 1", "category": "Áo", "price": 90_000,
                       "colors": ["Đen"], "sizes": ["M"]},
                      {"id": "two", "name": "Áo 2", "category": "Áo", "price": 120_000,
                       "colors": ["Trắng"], "sizes": ["L"]}]
        response = MagicMock()
        response.status_code = 200
        response.json.return_value = {"message": {"content": json.dumps({"ids": ["fake", "two"]})}}
        client_class.return_value.__enter__.return_value.post.return_value = response
        self.assertEqual([item["id"] for item in choose_products("tư vấn 2 áo", candidates)], ["two"])


if __name__ == "__main__":
    unittest.main()
