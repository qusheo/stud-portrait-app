import unittest

from django.test import Client
from django.urls import reverse

from portrait.endpoints.helpers.helpers import get_normalized
from portrait.endpoints.matchingService.matching_utils import (
    calculate_category_similarity,
    find_matching_students,
)
from portrait.models import Participants, Results

from ..base import BaseTestCase


class GetNormalizedTests(unittest.TestCase):
    def test_normalizes_into_zero_one_range(self):
        self.assertEqual(get_normalized(200), 0.0)
        self.assertEqual(get_normalized(800), 1.0)
        self.assertAlmostEqual(get_normalized(500), 0.5)

    def test_out_of_range_values_are_ignored(self):
        self.assertIsNone(get_normalized(199))
        self.assertIsNone(get_normalized(801))
        self.assertIsNone(get_normalized(None))
        self.assertIsNone(get_normalized(float("nan")))
        self.assertIsNone(get_normalized(float("inf")))


class CategorySimilarityTests(unittest.TestCase):
    def test_identical_rows_give_full_similarity(self):
        row = {"res_comp_a": 500, "res_comp_b": 600}
        similarity, coverage = calculate_category_similarity(
            row, row, ["res_comp_a", "res_comp_b"]
        )
        self.assertEqual(similarity, 100.0)
        self.assertEqual(coverage, 100.0)

    def test_max_difference_gives_zero_similarity(self):
        source = {"res_comp_a": 200}
        candidate = {"res_comp_a": 800}
        similarity, coverage = calculate_category_similarity(
            source, candidate, ["res_comp_a"]
        )
        self.assertEqual(similarity, 0.0)
        self.assertEqual(coverage, 100.0)

    def test_missing_values_reduce_coverage(self):
        source = {"res_comp_a": 500, "res_comp_b": None}
        candidate = {"res_comp_a": 500, "res_comp_b": 500}
        similarity, coverage = calculate_category_similarity(
            source, candidate, ["res_comp_a", "res_comp_b"]
        )
        self.assertEqual(similarity, 100.0)
        self.assertEqual(coverage, 50.0)

    def test_no_common_fields_returns_none(self):
        source = {"res_comp_a": None}
        candidate = {"res_comp_a": None}
        similarity, coverage = calculate_category_similarity(
            source, candidate, ["res_comp_a"]
        )
        self.assertIsNone(similarity)
        self.assertEqual(coverage, 0.0)


class FindMatchingStudentsTests(BaseTestCase):
    def setUp(self):
        self.source = Participants.objects.create(part_rsv_id="MATCH001")
        self.similar = Participants.objects.create(part_rsv_id="MATCH002")
        self.different = Participants.objects.create(part_rsv_id="MATCH003")

        Results.objects.create(
            res_participant=self.source, res_year="2024/2025", res_course=2,
            res_comp_communication=500, res_comp_leadership=500,
        )
        Results.objects.create(
            res_participant=self.similar, res_year="2024/2025", res_course=2,
            res_comp_communication=510, res_comp_leadership=490,
        )
        Results.objects.create(
            res_participant=self.different, res_year="2024/2025", res_course=2,
            res_comp_communication=200, res_comp_leadership=800,
        )

    def test_invalid_amount(self):
        for amount in (0, 101):
            with self.subTest(amount=amount):
                with self.assertRaises(ValueError):
                    find_matching_students(self.source.part_id, amount=amount)

    def test_all_categories_disabled(self):
        with self.assertRaises(ValueError):
            find_matching_students(
                self.source.part_id, motivators=False, competences=False, values=False
            )

    def test_unknown_student(self):
        with self.assertRaises(LookupError):
            find_matching_students(student_id=999999)

    def test_returns_sorted_matches(self):
        result = find_matching_students(self.source.part_id, amount=10)

        self.assertEqual(result["sourceStudentId"], self.source.part_id)
        ids = [row["studentId"] for row in result["students"]]
        self.assertEqual(
            ids, [self.similar.part_id, self.different.part_id]
        )
        overalls = [row["similarity"]["overall"] for row in result["students"]]
        self.assertEqual(overalls, sorted(overalls, reverse=True))

    def test_amount_limits_output(self):
        result = find_matching_students(self.source.part_id, amount=1)
        self.assertEqual(len(result["students"]), 1)
        self.assertEqual(result["total"], 2)


class MatchingStudentsEndpointTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.source = Participants.objects.create(part_rsv_id="MATCH004")
        Results.objects.create(
            res_participant=self.source, res_year="2024/2025", res_course=2,
            res_comp_communication=500,
        )

    def test_success(self):
        response = self.client.get(
            reverse("matching_students"), {"student_id": self.source.part_id}
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["data"]["sourceStudentId"], self.source.part_id)

    def test_student_not_found(self):
        response = self.client.get(reverse("matching_students"), {"student_id": 999999})
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json()["ok"])

    def test_invalid_params(self):
        response = self.client.get(reverse("matching_students"), {"student_id": "abc"})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["ok"])

    def test_wrong_method(self):
        response = self.client.post(
            reverse("matching_students"), {"student_id": self.source.part_id}
        )
        self.assertEqual(response.status_code, 405)
