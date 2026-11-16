import unittest

from app.services.knowledge import response_rule


class KnowledgeRuleTests(unittest.TestCase):
    def test_exact_hello_rule(self):
        self.assertEqual(response_rule('Nếu user nói hello', 'Trả lời là "Hello world"'),
                         ('hello', 'Hello world'))

    def test_general_document_is_not_a_rule(self):
        self.assertIsNone(response_rule('Chính sách giao hàng', 'Miễn phí vận chuyển từ 499k'))


if __name__ == '__main__':
    unittest.main()
