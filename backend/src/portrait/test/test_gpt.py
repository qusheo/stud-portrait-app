import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "studportrait.settings")
django.setup()

import unittest
import json
from types import SimpleNamespace
from unittest.mock import Mock, MagicMock, patch

from django.test import RequestFactory
from portrait.endpoints.statisticsService import stat


class DashboardPerformanceTests(unittest.TestCase):

    def test_query_count_does_not_grow_with_universities(self):
        universities = ["Университет 1", "Университет 2", "Университет 3"]
        query_count = 0

        def fake_filter(**kwargs):
            nonlocal query_count
            query_count += 1

            queryset = MagicMock()

            if query_count == 1:
                queryset.values_list.return_value.distinct.return_value = universities
            else:
                queryset.values_list.return_value = [(400, 500)]

            return queryset

        manager = SimpleNamespace(filter=Mock(side_effect=fake_filter))

        metrics = {
            "total_avg": 50,
            "course_percent": 30,
            "all_comps": {"comp_a": 50, "comp_b": 40},
            "motivator": {"name": "mot_1", "count": 60},
            "demotivator": {"name": "mot_2", "count": 40},
            "participated": {"amount_in": 10, "students_all": 12},
        }

        with (
            patch.object(stat, "Results", SimpleNamespace(objects=manager)),
            patch.object(stat, "COMP", SimpleNamespace(list=["comp_a", "comp_b"])),
            patch.object(stat, "get_year_metrics", return_value=metrics),
            patch.object(stat, "get_competency_stats_courses", return_value=[], create=True),
        ):
            request = RequestFactory().get("/dashboard/", {"year": "2025/2026"})
            response = stat.get_dashboard_stats(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            query_count,
            2,
            "Количество запросов должно быть постоянным, а не расти с числом университетов.",
        )


if __name__ == "__main__":
    unittest.main()

class DashboardErrorHandlingTests(unittest.TestCase):

    def test_database_error_returns_500(self):
        manager = SimpleNamespace(
            filter=Mock(side_effect=Exception("Database connection error"))
        )

        metrics = {
            "total_avg": 50,
            "course_percent": 30,
            "all_comps": {"comp_a": 50, "comp_b": 40},
            "motivator": {"name": "mot_1", "count": 60},
            "demotivator": {"name": "mot_2", "count": 40},
            "participated": {"amount_in": 10, "students_all": 12},
        }

        with (
            patch.object(stat, "Results", SimpleNamespace(objects=manager)),
            patch.object(stat, "get_year_metrics", return_value=metrics),
        ):
            request = RequestFactory().get(
                "/dashboard/",
                {"year": "2025/2026"},
            )
            response = stat.get_dashboard_stats(request)

        self.assertEqual(response.status_code, 500)
        self.assertFalse(json.loads(response.content)["ok"])
        self.assertIn("Database connection error", json.loads(response.content)["message"])


class DashboardCalculationTests(unittest.TestCase):

    def test_average_ignores_missing_competencies(self):
        queryset = MagicMock()
        queryset.exists.return_value = True
        queryset.aggregate.return_value = {
            "avg_comp_a": 80,
            "avg_comp_b": None,
        }
        queryset.values_list.return_value.distinct.return_value = [10]
        queryset.values.return_value.distinct.return_value.count.return_value = 1
        queryset.values.return_value.count.return_value = 1
        queryset.filter.return_value.count.return_value = 0

        course_manager = SimpleNamespace(
            filter=Mock(return_value=SimpleNamespace(
                count=Mock(return_value=1)
            ))
        )

        with (
            patch.object(
                stat,
                "Results",
                SimpleNamespace(objects=SimpleNamespace(
                    filter=Mock(return_value=queryset)
                )),
            ),
            patch.object(
                stat,
                "Courseresults",
                SimpleNamespace(objects=course_manager),
            ),
            patch.object(stat, "COMP", SimpleNamespace(list=["comp_a", "comp_b"])),
            patch.object(stat, "MOT", SimpleNamespace(list=["mot_a"])),
        ):
            result = stat.get_year_metrics("2025/2026", {})

        self.assertEqual(
            result["total_avg"],
            80,
            "Среднее должно рассчитываться по заполненным компетенциям.",
        )

class DashboardEmptyScoresTests(unittest.TestCase):

    def test_dashboard_handles_university_without_competency_scores(self):
        query_count = 0

        def fake_filter(**kwargs):
            nonlocal query_count
            query_count += 1

            queryset = MagicMock()

            if query_count == 1:
                queryset.values_list.return_value.distinct.return_value = [
                    "Университет 1"
                ]
            else:
                queryset.values_list.return_value = [(None, 0)]

            return queryset

        manager = SimpleNamespace(filter=Mock(side_effect=fake_filter))

        metrics = {
            "total_avg": 0,
            "course_percent": 0,
            "all_comps": {"comp_a": 0, "comp_b": 0},
            "motivator": {"name": "-", "count": 0},
            "demotivator": {"name": "-", "count": 0},
            "participated": {"amount_in": 0, "students_all": 0},
        }

        with (
            patch.object(stat, "Results", SimpleNamespace(objects=manager)),
            patch.object(stat, "COMP", SimpleNamespace(list=["comp_a", "comp_b"])),
            patch.object(stat, "get_year_metrics", return_value=metrics),
            patch.object(stat, "get_competency_stats_courses", return_value=[], create=True),
        ):
            request = RequestFactory().get(
                "/dashboard/",
                {"year": "2025/2026"},
            )
            response = stat.get_dashboard_stats(request)

        print("DASHBOARD RESPONSE:", response.status_code, response.content.decode("utf-8"))
        self.assertEqual(
            response.status_code,
            200,
            "Отсутствие оценок университета не должно приводить к ошибке API.",
        )


class DashboardDataEdgeCasesTests(unittest.TestCase):

    def test_course_percentage_does_not_exceed_100_with_multiple_courses(self):
        queryset = MagicMock()
        queryset.exists.return_value = True
        queryset.aggregate.return_value = {"avg_comp_a": 70}
        queryset.values_list.return_value.distinct.return_value = [1, 2]
        queryset.values.return_value.distinct.return_value.count.return_value = 2

        course_manager = SimpleNamespace(
            filter=Mock(return_value=SimpleNamespace(
                count=Mock(return_value=3)
            ))
        )

        with (
            patch.object(
                stat, "Results",
                SimpleNamespace(objects=SimpleNamespace(
                    filter=Mock(return_value=queryset)
                )),
            ),
            patch.object(
                stat, "Courseresults",
                SimpleNamespace(objects=course_manager),
            ),
            patch.object(stat, "COMP", SimpleNamespace(list=["comp_a"])),
            patch.object(stat, "MOT", SimpleNamespace(list=[])),
        ):
            result = stat.get_year_metrics("2025/2026", {})

        self.assertEqual(
            result["course_percent"],
            100,
            "Доля студентов с курсами не должна превышать 100%, даже если у студента несколько курсов.",
        )

    def test_motivator_percentage_ignores_missing_values(self):
        queryset = MagicMock()
        queryset.exists.return_value = True
        queryset.aggregate.return_value = {"avg_comp_a": 70}
        queryset.values_list.return_value.distinct.return_value = [1, 2]
        queryset.values.return_value.distinct.return_value.count.return_value = 2
        queryset.values.return_value.count.return_value = 2

        high_queryset = MagicMock()
        high_queryset.count.return_value = 1

        low_queryset = MagicMock()
        low_queryset.count.return_value = 0

        queryset.filter.side_effect = [high_queryset, low_queryset]

        course_manager = SimpleNamespace(
            filter=Mock(return_value=SimpleNamespace(
                count=Mock(return_value=0)
            ))
        )

        with (
            patch.object(
                stat, "Results",
                SimpleNamespace(objects=SimpleNamespace(
                    filter=Mock(return_value=queryset)
                )),
            ),
            patch.object(
                stat, "Courseresults",
                SimpleNamespace(objects=course_manager),
            ),
            patch.object(stat, "COMP", SimpleNamespace(list=["comp_a"])),
            patch.object(stat, "MOT", SimpleNamespace(list=["mot_a"])),
        ):
            result = stat.get_year_metrics("2025/2026", {})

        self.assertEqual(
            result["motivator"]["count"],
            100,
            "Процент мотиватора должен рассчитываться по заполненным значениям, если NULL означает отсутствие оценки.",
        )

    def test_empty_year_returns_zero_metrics(self):
        queryset = MagicMock()
        queryset.exists.return_value = False

        course_manager = SimpleNamespace(filter=Mock())

        with (
            patch.object(
                stat, "Results",
                SimpleNamespace(objects=SimpleNamespace(
                    filter=Mock(return_value=queryset)
                )),
            ),
            patch.object(
                stat, "Courseresults",
                SimpleNamespace(objects=course_manager),
            ),
            patch.object(stat, "COMP", SimpleNamespace(list=["comp_a", "comp_b"])),
            patch.object(stat, "MOT", SimpleNamespace(list=["mot_a"])),
        ):
            result = stat.get_year_metrics("2025/2026", {})

        self.assertEqual(result["total_avg"], 0)
        self.assertEqual(result["course_percent"], 0)
        self.assertEqual(result["all_comps"], {"comp_a": 0, "comp_b": 0})
        self.assertEqual(result["motivator"]["count"], 0)
        course_manager.filter.assert_not_called()
