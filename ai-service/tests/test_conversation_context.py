import unittest

from app.services.conversation import catalog_count_question, retrieval_query, size_followup, store_location_question


class ConversationContextTests(unittest.TestCase):
    def test_measurement_followup_uses_recent_size_context(self):
        history = [
            {"role": "user", "content": "Cân nặng của tôi nên mặc size gì?"},
            {"role": "assistant", "content": "Bạn cho mình chiều cao và cân nặng nhé."},
        ]
        self.assertTrue(size_followup("1.7m 58kg", history))
        self.assertTrue(size_followup("mình nặng 58kg, cao 1.7m", history))
        self.assertIn("chọn size", retrieval_query("1.7m 58kg", sizing=True))

    def test_measurement_is_not_assumed_to_be_size_without_context(self):
        history = [{"role": "assistant", "content": "Phí giao hàng là 30.000đ."}]
        self.assertFalse(size_followup("1.7m 58kg", history))

    def test_catalog_count_is_not_a_product_recommendation(self):
        self.assertTrue(catalog_count_question("Shop có bao nhiêu sản phẩm?"))
        self.assertTrue(catalog_count_question("Tổng số mặt hàng là bao nhiêu?"))
        self.assertFalse(catalog_count_question("Tôi muốn mua áo"))

    def test_retired_store_lookup_does_not_capture_catalog_questions(self):
        self.assertTrue(store_location_question("Hệ thống cửa hàng ở đâu?"))
        self.assertTrue(store_location_question("Có shop nào gần tôi không?"))
        self.assertFalse(store_location_question("Shop có bao nhiêu sản phẩm?"))


if __name__ == "__main__":
    unittest.main()
