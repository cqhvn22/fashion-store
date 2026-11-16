import json
import os
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

from app.ingestion.workbook import load_products
from app.services.model import choose_products
from app.services.products import _budget, _requested_color, _requested_size, _requested_types, document_text


class WorkbookTests(unittest.TestCase):
    def test_dataset_is_cleaned_without_repeated_policy(self):
        source = Path(os.environ.get("WORKBOOK_PATH", str(Path(__file__).resolve().parents[1] / "atino_products.xlsx")))
        records, report = load_products(source)
        self.assertEqual(report["rows"], 280)
        self.assertEqual(report["valid"], 280)
        self.assertEqual(report["duplicate_ids"], 0)
        self.assertEqual(report["product_descriptions"], 0)
        self.assertTrue(all(item["price"] > 0 for item in records))
        self.assertNotIn("Đổi hàng trong vòng", document_text(records[0]))

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
