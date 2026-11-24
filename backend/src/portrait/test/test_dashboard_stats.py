import json
from unittest.mock import patch

from django.test import RequestFactory, SimpleTestCase

from portrait.endpoints.statisticsService import stat


class FakeQuerySet:
    def __init__(self, rows):
        self.rows = rows

    def filter(self, *args, **kwargs):
        return self

    def values(self, *args, **kwargs):
        return self

    def annotate(self, **kwargs):
        return self

    def __iter__(self):
        return iter(self.rows)


class FakeManager:
    def __init__(self, rows=None):
        self.queryset = FakeQuerySet(rows or [])
        self.calls = []

    def filter(self, *args, **kwargs):
        self.calls.append(kwargs)
        return self.queryset

    def all(self):
        return self.queryset


def make_year_metrics(total_avg=500, course_percent=20):
    return {
        "total_avg": total_avg,
        "course_percent": course_percent,
        "all_comps": {
            field: total_avg
            for field in stat.COMP.list
        },
        "motivator": {
            "name": stat.MOT.list[0],
            "count": 25,
        },
        "demotivator": {
            "name": stat.MOT.list[0],
            "count": 10,
        },
        "participated": {
            "amount_in": 10,
            "students_all": 100,
        },
    }


def make_university_rows():
    rows = []

    for name, value in (
        ("ВУЗ 1", 700),
        ("ВУЗ 2", 500),
    ):
        row = {
            "res_institution__inst_name": name,
        }

        for index, _field in enumerate(stat.COMP.list):
            row[f"sum_{index}"] = value
            row[f"count_{index}"] = 1

        rows.append(row)

    return rows


class DashboardStatsTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def orm_patches(self, university_rows=None):
        return (
            patch.object(
                stat.Results,
                "objects",
                FakeManager(university_rows),
            ),
            patch.object(
                stat.StudentsAmount,
                "objects",
                FakeManager(),
            ),
            patch.object(
                stat.Courseresults,
                "objects",
                FakeManager(),
            ),
        )

    def test_returns_dashboard_structure_for_selected_year_and_filters(self):
        request = self.factory.get(
            "/portrait/dashboard-stats/",
            {
                "institute": "ВУЗ 1",
                "specialty": "Информатика",
                "year": "2024/2025",
            },
        )

        metrics = {
            "2024/2025": make_year_metrics(
                total_avg=600,
                course_percent=30,
            ),
            "2023/2024": make_year_metrics(
                total_avg=500,
                course_percent=20,
            ),
        }

        def get_metrics(year, filters):
            return metrics[year]

        results_patch, students_patch, courses_patch = self.orm_patches(
            make_university_rows()
        )

        with (
            results_patch,
            students_patch,
            courses_patch,
            patch.object(
                stat,
                "get_year_metrics",
                side_effect=get_metrics,
            ) as get_year_metrics_mock,
            patch.object(
                stat,
                "get_competency_stats_courses",
                return_value=[],
            ),
        ):
            response = stat.get_dashboard_stats(request)

        self.assertEqual(response.status_code, 200)

        payload = json.loads(response.content)

        self.assertTrue(payload["ok"])
        self.assertIn("col1", payload)
        self.assertIn("col2", payload)
        self.assertIn("col3", payload)
        self.assertIn("year", payload)
        self.assertIn("radar", payload)

        self.assertEqual(payload["year"], "2025")
        self.assertEqual(payload["col1"]["avg_lvl"]["val"], 600)
        self.assertEqual(payload["col1"]["avg_lvl"]["prev"], 500)

        self.assertEqual(
            get_year_metrics_mock.call_args_list[0].args,
            (
                "2024/2025",
                {
                    "res_institution__inst_name": "ВУЗ 1",
                    "res_edu_specialty__spec_name": "Информатика",
                    "res_year": "2024/2025",
                },
            ),
        )

        self.assertEqual(
            get_year_metrics_mock.call_args_list[1].args,
            (
                "2023/2024",
                {
                    "res_institution__inst_name": "ВУЗ 1",
                    "res_edu_specialty__spec_name": "Информатика",
                    "res_year": "2024/2025",
                },
            ),
        )

    def test_uses_default_current_and_previous_year_when_year_is_missing(self):
        request = self.factory.get(
            "/portrait/dashboard-stats/",
            {
                "institute": "",
                "specialty": "",
            },
        )

        results_patch, students_patch, courses_patch = self.orm_patches(
            make_university_rows()
        )

        with (
            results_patch,
            students_patch,
            courses_patch,
            patch.object(
                stat,
                "get_year_metrics",
                return_value=make_year_metrics(),
            ) as get_year_metrics_mock,
            patch.object(
                stat,
                "get_competency_stats_courses",
                return_value=[],
            ),
        ):
            response = stat.get_dashboard_stats(request)

        self.assertEqual(response.status_code, 200)

        self.assertEqual(
            get_year_metrics_mock.call_args_list[0].args[0],
            "2025/2026",
        )
        self.assertEqual(
            get_year_metrics_mock.call_args_list[1].args[0],
            "2024/2025",
        )

        payload = json.loads(response.content)

        self.assertEqual(payload["year"], "2026")

    def test_returns_zero_like_values_when_both_years_have_no_data(self):
        request = self.factory.get(
            "/portrait/dashboard-stats/",
            {
                "year": "2024/2025",
            },
        )

        empty_metrics = make_year_metrics(
            total_avg=0,
            course_percent=0,
        )
        empty_metrics["all_comps"] = {
            field: 0
            for field in stat.COMP.list
        }
        empty_metrics["motivator"] = {
            "name": "-",
            "count": 0,
        }
        empty_metrics["demotivator"] = {
            "name": "-",
            "count": 0,
        }
        empty_metrics["participated"] = {
            "amount_in": 0,
            "students_all": 0,
        }

        results_patch, students_patch, courses_patch = self.orm_patches()

        with (
            results_patch,
            students_patch,
            courses_patch,
            patch.object(
                stat,
                "get_year_metrics",
                return_value=empty_metrics,
            ),
            patch.object(
                stat,
                "get_competency_stats_courses",
                return_value=[],
            ),
        ):
            response = stat.get_dashboard_stats(request)

        self.assertEqual(response.status_code, 200)

        payload = json.loads(response.content)

        self.assertTrue(payload["ok"])
        self.assertEqual(payload["col1"]["avg_lvl"]["val"], 0)
        self.assertEqual(
            payload["col2"]["participated"]["amount_in"],
            0,
        )
        self.assertEqual(
            payload["col2"]["participated"]["students_all"],
            0,
        )