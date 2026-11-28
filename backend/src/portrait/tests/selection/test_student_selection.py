import json
import unittest

from django.test import Client
from django.urls import reverse

from portrait.endpoints.selectionService.student_selection import (
    calculate_requirements_score,
    find_students_by_requirements,
    parse_requirements,
)
from portrait.models import Participants, Results

from ..base import BaseTestCase


class ParseRequirementsTests(unittest.TestCase):
    def test_unknown_category(self):
        with self.assertRaises(ValueError):
            parse_requirements({"unknown": {}})

    def test_unknown_indicator(self):
        with self.assertRaises(ValueError):
            parse_requirements({"competencies": {"res_comp_fake": "high"}})

    def test_unknown_level(self):
        with self.assertRaises(ValueError):
            parse_requirements({"competencies": {"res_comp_leadership": "extreme"}})

    def test_empty_indicators_use_medium_level(self):
        filters = parse_requirements({"competencies": {}})
        self.assertEqual(filters["res_comp_leadership"], (400, 800, False))

    def test_levels_mapping(self):
        filters = parse_requirements(
            {"competencies": {"res_comp_leadership": "basic"}}
        )
        self.assertEqual(filters["res_comp_leadership"], (200, 800, False))

    def test_requirements_must_be_dicts(self):
        with self.assertRaises(ValueError):
            parse_requirements({"competencies": ["res_comp_leadership"]})


class RequirementsScoreTests(unittest.TestCase):
    def test_no_filters_returns_none(self):
        self.assertIsNone(calculate_requirements_score({"res_comp_leadership": 500}, {}))

    def test_max_value_gives_hundred(self):
        filters = {"res_comp_leadership": (400, 800, False)}
        score = calculate_requirements_score(
            {"res_comp_leadership": 800}, filters
        )
        self.assertEqual(score, 100.0)

    def test_min_value_gives_zero(self):
        filters = {"res_comp_leadership": (400, 800, False)}
        score = calculate_requirements_score(
            {"res_comp_leadership": 400}, filters
        )
        self.assertEqual(score, 0.0)


class FindStudentsByRequirementsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.high = Participants.objects.create(part_rsv_id="SEL001")
        Results.objects.create(
            res_participant=self.high, res_year="2024/2025", res_course=2,
            res_comp_leadership=700,
        )
        self.low = Participants.objects.create(part_rsv_id="SEL002")
        Results.objects.create(
            res_participant=self.low, res_year="2024/2025", res_course=2,
            res_comp_leadership=300,
        )

    def post(self, body):
        return self.client.post(
            reverse("students_by_requirements"),
            data=json.dumps(body),
            content_type="application/json",
        )

    def test_no_requirements_returns_all_with_null_score(self):
        response = self.post({})
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(data["total"], 2)
        self.assertTrue(all(
            student["matchScore"] is None for student in data["students"]
        ))

    def test_high_level_filters_low_scores(self):
        response = self.post({
            "requirements": {"competencies": {"res_comp_leadership": "high"}}
        })
        data = response.json()["data"]
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["students"][0]["studentId"], self.high.part_id)

    def test_match_score_is_sorted(self):
        response = self.post({
            "requirements": {"competencies": {"res_comp_leadership": "basic"}}
        })
        data = response.json()["data"]
        scores = [student["matchScore"] for student in data["students"]]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_course_filter(self):
        response = self.post({"courses": [1]})
        self.assertEqual(response.json()["data"]["total"], 0)

    def test_invalid_limit(self):
        for limit in (0, 101):
            response = self.post({"limit": limit})
            self.assertEqual(response.status_code, 400)

    def test_negative_offset(self):
        response = self.post({"offset": -1})
        self.assertEqual(response.status_code, 400)

    def test_invalid_requirements_shape(self):
        response = self.post({"requirements": ["not-a-dict"]})
        self.assertEqual(response.status_code, 400)

    def test_wrong_method(self):
        response = self.client.get(reverse("students_by_requirements"))
        self.assertEqual(response.status_code, 405)
