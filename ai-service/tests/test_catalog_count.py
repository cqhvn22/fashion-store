import unittest
from unittest.mock import MagicMock, patch

from app.services.products import catalog_product_count


class CatalogCountTests(unittest.TestCase):
    @patch("app.services.products.INTERNAL_API_KEY", "test-key")
    @patch("app.services.products.httpx.Client")
    def test_uses_live_catalog_total_instead_of_retrieval_limit(self, client_class):
        response = MagicMock()
        response.json.return_value = {"data": {"totalElements": 280}}
        client_class.return_value.__enter__.return_value.get.return_value = response
        self.assertEqual(catalog_product_count(), (280, True))
        params = client_class.return_value.__enter__.return_value.get.call_args.kwargs["params"]
        self.assertEqual(params, {"page": 1, "limit": 1})


if __name__ == "__main__":
    unittest.main()
