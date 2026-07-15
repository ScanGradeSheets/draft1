import unittest

from scripts.serve_trocr_review import visible_token_probabilities


class FakeTokenizer:
    all_special_ids = [0, 2, 3]

    def decode(self, token_ids, skip_special_tokens=True):
        values = {2: '', 401: '6', 402: '7', 999: 'x'}
        return ''.join(values.get(int(token_id), '') for token_id in token_ids)


class VisibleTokenConfidenceTest(unittest.TestCase):
    def test_excludes_eos_from_answer_confidence(self):
        self.assertEqual(
            visible_token_probabilities(FakeTokenizer(), [401, 2], [0.9998, 0.0]),
            [0.9998],
        )

    def test_keeps_each_visible_digit_and_ignores_non_digit_tokens(self):
        self.assertEqual(
            visible_token_probabilities(FakeTokenizer(), [401, 402, 999, 2], [0.99, 0.98, 0.97, 0.01]),
            [0.99, 0.98],
        )


if __name__ == '__main__':
    unittest.main()
