import unittest

from django.test import Client
from django.urls import reverse

from portrait.constants import RsvCompetencies as COMP
from portrait.endpoints.statisticsService.stat import _grade_to_number
from portrait.models import (
    Academicperformances,
    Institutions,
    Participants,
    Results,
    Specialties,
)

from ..base import BaseTestCase


class GradeToNumberTests(unittest.TestCase):
    def test_text_grades(self):
        self.assertEqual(_grade_to_number("отл."), 5)
        self.assertEqual(_grade_to_number("Хор."), 4)
        self.assertEqual(_grade_to_number("зачёт"), 5)
        self.assertEqual(_grade_to_number("незач."), 2)

    def test_numeric_grades(self):
        self.assertEqual(_grade_to_number("5"), 5)
        self.assertEqual(_grade_to_number(4), 4)
        self.assertEqual(_grade_to_number(4.0), 4)
        self.assertIsNone(_grade_to_number(6))
        self.assertIsNone(_grade_to_number(0))

    def test_unrecognized(self):
        self.assertIsNone(_grade_to_number(None))
        self.assertIsNone(_grade_to_number("превосходно"))


class FilterOptionsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.institution = Institutions.objects.create(inst_name="ТюмГУ")
        self.specialty = Specialties.objects.create(spec_name="Информатика")
        participant = Participants.objects.create(part_rsv_id="FO001")
        Results.objects.create(
            res_participant=participant,
            res_year="2024/2025",
            res_course=2,
            res_institution=self.institution,
            res_edu_specialty=self.specialty,
        )

    def test_filter_options(self):
        response = self.client.get(reverse("filter_options"))
        data = response.json()["data"]
        self.assertEqual([i["value"] for i in data["institutes"]], ["ТюмГУ"])
        self.assertEqual([s["value"] for s in data["specialties"]], ["Информатика"])
        self.assertEqual([y["value"] for y in data["years"]], ["2024/2025"])

    def test_filter_options_by_institute(self):
        other_institution = Institutions.objects.create(inst_name="Другой ВУЗ")
        other = Participants.objects.create(part_rsv_id="FO002")
        Results.objects.create(
            res_participant=other,
            res_year="2023/2024",
            res_course=1,
            res_institution=other_institution,
        )

        response = self.client.get(reverse("filter_options"), {"institute": "ТюмГУ"})
        data = response.json()["data"]
        self.assertEqual([y["value"] for y in data["years"]], ["2024/2025"])
        self.assertEqual(len(data["institutes"]), 2)

    def test_available_years(self):
        response = self.client.get(reverse("available_years"))
        self.assertEqual(response.json()["data"], [{"value": "2024/2025", "label": "2024/2025"}])

    def test_overall_stats(self):
        response = self.client.get(reverse("overall_stats"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["unis"], 1)
        self.assertEqual(payload["results"], 1)
        self.assertEqual(payload["years"], {"min": 2024, "max": 2025})


class CompetencyAverageByYearsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        participant = Participants.objects.create(part_rsv_id="CAY001")
        Results.objects.create(
            res_participant=participant, res_year="2023/2024", res_course=1,
            res_comp_leadership=400,
        )
        Results.objects.create(
            res_participant=participant, res_year="2024/2025", res_course=2,
            res_comp_leadership=500,
        )

    def test_averages_grouped_by_year(self):
        response = self.client.get(reverse("competency_average_by_years"))
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        self.assertEqual(len(data), 2 * len(COMP.list))
        leadership = [
            row for row in data if row["name"] == "res_comp_leadership"
        ]
        by_year = {row["year"]: row["average"] for row in leadership}
        self.assertEqual(by_year, {"2023/2024": 400, "2024/2025": 500})


class MotivationCountsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        for index, score in enumerate((300, 700)):
            participant = Participants.objects.create(part_rsv_id=f"MC{index:03d}")
            Results.objects.create(
                res_participant=participant,
                res_year="2024/2025",
                res_course=1,
                res_mot_purpose=score,
            )

    def test_counts_split_into_low_mid_high(self):
        response = self.client.get(reverse("motivation_counts"))
        self.assertEqual(response.status_code, 200)
        data = response.json()["data"]
        purpose = next(row for row in data if row["name"] == "res_mot_purpose")
        self.assertEqual(purpose["course_1_low"], 0.5)
        self.assertEqual(purpose["course_1_high"], 0.5)
        self.assertEqual(purpose["course_1_mid"], 0)
        self.assertEqual(purpose["course_2_high"], 0)


class ScoresResultTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_no_performance_data(self):
        response = self.client.get(reverse("scores_result"))
        self.assertEqual(response.status_code, 500)
        self.assertFalse(response.json()["ok"])

    def test_success(self):
        participant = Participants.objects.create(part_rsv_id="SR001")
        Results.objects.create(
            res_participant=participant, res_year="2024/2025", res_course=2,
            res_comp_leadership=500,
        )
        Academicperformances.objects.create(
            perf_participant=participant,
            perf_year="2024/2025",
            perf_discipline="УП",
            perf_main="5",
        )

        response = self.client.get(reverse("scores_result"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["names"], ["ПИР", "УП", "Эксплуатационная практика", "Преддипломная практика"])
        self.assertEqual(payload["data"][0]["discipline"], "УП")
        self.assertEqual(payload["data"][0]["participants"][0]["grade"], 5)


class GradesCompetencyCorrelationTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def seed_pairs(self, n=4):
        for index in range(n):
            participant = Participants.objects.create(part_rsv_id=f"GC{index:03d}")
            Results.objects.create(
                res_participant=participant, res_year="2024/2025", res_course=2,
                res_comp_leadership=400 + index * 50,
            )
            Academicperformances.objects.create(
                perf_participant=participant,
                perf_year="2024/2025",
                perf_discipline="Математика",
                perf_main=str(2 + index),
            )

    def test_empty_db(self):
        response = self.client.get(reverse("grades_competency_correlation"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["correlations"], [])
        self.assertEqual(payload["scatter"], [])

    def test_correlation_and_scatter(self):
        self.seed_pairs()
        response = self.client.get(reverse("grades_competency_correlation"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertIn("Математика", payload["disciplines"])
        leadership = next(
            c for c in payload["correlations"]
            if c["competency"] == "res_comp_leadership"
        )
        self.assertGreater(leadership["value"], 0.9)
        self.assertEqual(leadership["n"], 4)
        self.assertEqual(len(payload["scatter"]), 4)

    def test_scatter_for_requested_pair(self):
        self.seed_pairs()
        response = self.client.get(
            reverse("grades_competency_correlation"),
            {"discipline": "Математика", "competency": "res_comp_leadership"},
        )
        scatter = response.json()["scatter"]
        self.assertEqual(len(scatter), 4)
        self.assertEqual(scatter[0]["discipline"], "Математика")


class CompetencyTrendTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_trend_by_course(self):
        for course, score in ((1, 400), (2, 500)):
            participant = Participants.objects.create(part_rsv_id=f"CT{course:03d}")
            Results.objects.create(
                res_participant=participant, res_year="2024/2025", res_course=course,
                res_comp_leadership=score,
            )

        response = self.client.get(reverse("competency_trend_by_year"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        leadership = next(
            t for t in payload["trends"] if t["competency"] == "res_comp_leadership"
        )
        self.assertEqual(
            leadership["points"],
            [{"course": 1, "avg": 400.0, "n": 1}, {"course": 2, "avg": 500.0, "n": 1}],
        )

    def test_empty_db(self):
        response = self.client.get(reverse("competency_trend_by_year"))
        self.assertEqual(response.json()["trends"], [])


class TopCorrelationsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_no_students(self):
        response = self.client.get(reverse("top_correlations"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["top"], [])
        self.assertIn("Нет студентов", payload["message"])

    def test_success_with_min_n(self):
        for index in range(4):
            participant = Participants.objects.create(part_rsv_id=f"TC{index:03d}")
            Results.objects.create(
                res_participant=participant, res_year="2024/2025", res_course=2,
                res_comp_leadership=400 + index * 50,
            )
            Academicperformances.objects.create(
                perf_participant=participant,
                perf_year="2024/2025",
                perf_discipline="Математика",
                perf_main=str(2 + index),
            )

        response = self.client.get(reverse("top_correlations"), {"min_n": 3, "top_n": 5})
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["params"]["min_n"], 3)
        self.assertTrue(payload["top"])
        ranks = [item["rank"] for item in payload["top"]]
        self.assertEqual(ranks, list(range(1, len(ranks) + 1)))

    def test_invalid_params_fall_back_to_defaults(self):
        response = self.client.get(
            reverse("top_correlations"),
            {"top_n": "abc", "sort_by": "weird", "min_n": "x"},
        )
        params = response.json()["params"]
        self.assertEqual(params["top_n"], 20)
        self.assertEqual(params["sort_by"], "abs")
        self.assertEqual(params["min_n"], 30)


class CompetencySegmentationTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_competency_required(self):
        response = self.client.get(reverse("competency_segmentation"))
        self.assertEqual(response.status_code, 400)

    def test_unknown_competency_rejected(self):
        response = self.client.get(
            reverse("competency_segmentation"), {"competency": "res_comp_fake"}
        )
        self.assertEqual(response.status_code, 400)

    def test_empty_db(self):
        response = self.client.get(
            reverse("competency_segmentation"), {"competency": "res_comp_leadership"}
        )
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["total_n"], 0)
        self.assertEqual(payload["groups"], [])

    def test_segmentation_into_three_groups(self):
        scores = [300, 350, 400, 450, 500, 550, 600, 700]
        for index, score in enumerate(scores):
            participant = Participants.objects.create(part_rsv_id=f"SEG{index:03d}")
            Results.objects.create(
                res_participant=participant, res_year="2024/2025", res_course=2,
                res_comp_leadership=score, res_mot_purpose=700,
            )

        response = self.client.get(
            reverse("competency_segmentation"), {"competency": "res_comp_leadership"}
        )
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["total_n"], len(scores))
        self.assertEqual(
            [group["name"] for group in payload["groups"]],
            ["low", "middle", "high"],
        )
        self.assertEqual(
            sum(group["n"] for group in payload["groups"]), len(scores)
        )
        self.assertLess(payload["q1"], payload["q3"])
