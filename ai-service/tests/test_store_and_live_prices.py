import unittest
from unittest.mock import MagicMock, patch

from app.services.stores import nearest, by_area
from app.services.products import refresh_live_products
from app.services.model import generate_ai_chat


class StoreSearchTests(unittest.TestCase):
    def test_coordinates_rank_city_store_first(self):
        stores = nearest(21.0112, 105.8491)
        self.assertEqual(stores[0]["name"], "FashionHub Vincom Bà Triệu")
        self.assertEqual(stores[0]["distanceKm"], 0)

    def test_manual_area_when_location_denied(self):
        self.assertTrue(all(row["city"] == "Đà Nẵng" for row in by_area("Tôi ở Đà Nẵng")))


class LivePriceTests(unittest.TestCase):
    @patch("app.services.products.httpx.Client")
    def test_rechecks_price_and_promotion(self, client_class):
        response = MagicMock(status_code=200)
        response.json.return_value = {"data": {
            "name": "Áo mới", "images": [{"url": "/new.jpg"}],
            "promotion": {"name": "Sale hôm nay"},
            "variants": [{"isActive": True, "stockQuantity": 3, "price": 90000,
                          "compareAtPrice": 120000, "color": "Đen", "size": "M"}],
        }}
        client_class.return_value.__enter__.return_value.get.return_value = response
        result = refresh_live_products([{"source": "catalog", "slug": "ao-moi", "price": 120000}], "áo dưới 100k")
        self.assertEqual(result[0]["price"], 90000)
        self.assertEqual(result[0]["promotion"], "Sale hôm nay")

    @patch("app.services.products.httpx.Client")
    def test_hidden_product_is_removed(self, client_class):
        client_class.return_value.__enter__.return_value.get.return_value = MagicMock(status_code=404)
        self.assertEqual(refresh_live_products([{"source": "catalog", "slug": "hidden"}], "áo"), [])


class PersonalizationTests(unittest.TestCase):
    @patch("app.services.model.AI_PROVIDER", "openrouter")
    @patch("app.services.model.call_openrouter", return_value="Xin chào")
    def test_verified_tier_is_passed_to_model(self, call):
        generate_ai_chat("Có ưu đãi gì?", [], [], [], customer_context="Khách hạng Vàng có 200 điểm")
        self.assertIn("hạng Vàng", call.call_args.kwargs["system_instruction"])


if __name__ == "__main__":
    unittest.main()
