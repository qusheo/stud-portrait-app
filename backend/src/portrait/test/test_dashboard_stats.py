import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, MagicMock, patch

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


class DashboardYearMetricsTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def call_year_metrics(self, aggregate_data, courses_count=0, students_with_courses=0, competencies=None, motivators=None):
        queryset = MagicMock()
        queryset.aggregate.return_value = aggregate_data

        students_amount_queryset = MagicMock()
        students_amount_queryset.aggregate.return_value = {"total": 0}

        course_queryset = MagicMock()
        course_queryset.count.return_value = courses_count
        # Имитация .values('course_participant_id').distinct().count() —
        # число студентов с хотя бы одним курсом.
        course_queryset.values.return_value.distinct.return_value.count.return_value = students_with_courses

        with (
            patch.object(
                stat,
                "Results",
                SimpleNamespace(
                    objects=SimpleNamespace(
                        filter=Mock(return_value=queryset)
                    )
                ),
            ),
            patch.object(
                stat,
                "StudentsAmount",
                SimpleNamespace(
                    objects=SimpleNamespace(
                        filter=Mock(return_value=students_amount_queryset),
                        none=Mock(return_value=students_amount_queryset),
                    )
                ),
            ),
            patch.object(
                stat,
                "Courseresults",
                SimpleNamespace(
                    objects=SimpleNamespace(
                        filter=Mock(return_value=course_queryset)
                    )
                ),
            ),
            patch.object(
                stat,
                "COMP",
                SimpleNamespace(list=competencies or ["comp_a"]),
            ),
            patch.object(
                stat,
                "MOT",
                SimpleNamespace(list=motivators or []),
            ),
        ):
            return stat.get_year_metrics("2025/2026", {})

    def test_average_replaces_missing_and_below_200_with_floor(self):
        result = self.call_year_metrics(
            {
                "total": 2,
                "students": 2,
                "avg_comp_a": 600,
                "avg_comp_b": 150,
                "avg_comp_c": None,
            },
            competencies=["comp_a", "comp_b", "comp_c"],
        )

        # Значение ниже 200 и незаполненное засчитываются как 200,
        # остальные сохраняются.
        self.assertEqual(result["all_comps"], {"comp_a": 600, "comp_b": 200, "comp_c": 200})
        self.assertEqual(result["total_avg"], 333.33)

    def test_course_percentage_counts_students_not_course_records(self):
        # 2 студента, 3 записи о курсах принадлежат одному студенту:
        # доля — 1 из 2 (50%), а не 3 из 2 (150%).
        result = self.call_year_metrics(
            {
                "total": 2,
                "students": 2,
                "avg_comp_a": 70,
            },
            courses_count=3,
            students_with_courses=1,
        )

        self.assertEqual(result["course_percent"], 50.0)

    def test_course_percentage_is_hundred_when_all_students_have_courses(self):
        result = self.call_year_metrics(
            {
                "total": 2,
                "students": 2,
                "avg_comp_a": 70,
            },
            courses_count=5,
            students_with_courses=2,
        )

        self.assertEqual(result["course_percent"], 100.0)

    def test_motivator_percentage_counts_only_students_with_value(self):
        # 2 студента, значение мотиватора заполнено у одного и он ≥600:
        # доля — 1 из 1 заполненных (100%), NULL значит «нет данных».
        result = self.call_year_metrics(
            {
                "total": 2,
                "students": 2,
                "avg_comp_a": 70,
                "high_0": 1,
                "low_0": 0,
                "filled_0": 1,
            },
            competencies=["comp_a"],
            motivators=["mot_a"],
        )

        self.assertEqual(result["motivator"], {"name": "mot_a", "count": 100.0})

    def test_empty_year_returns_zero_metrics_without_course_query(self):
        course_manager = SimpleNamespace(
            filter=Mock()
        )
        queryset = MagicMock()
        queryset.aggregate.return_value = {
            "total": 0,
            "students": 0,
            "avg_comp_a": None,
            "avg_comp_b": None,
        }
        students_amount_queryset = MagicMock()
        students_amount_queryset.aggregate.return_value = {"total": 0}

        with (
            patch.object(
                stat,
                "Results",
                SimpleNamespace(
                    objects=SimpleNamespace(
                        filter=Mock(return_value=queryset)
                    )
                ),
            ),
            patch.object(
                stat,
                "StudentsAmount",
                SimpleNamespace(
                    objects=SimpleNamespace(
                        filter=Mock(return_value=students_amount_queryset)
                    )
                ),
            ),
            patch.object(
                stat,
                "Courseresults",
                SimpleNamespace(objects=course_manager),
            ),
            patch.object(
                stat,
                "COMP",
                SimpleNamespace(list=["comp_a", "comp_b"]),
            ),
            patch.object(
                stat,
                "MOT",
                SimpleNamespace(list=["mot_a"]),
            ),
        ):
            result = stat.get_year_metrics("2025/2026", {})

        self.assertEqual(result["total_avg"], 0)
        self.assertEqual(result["course_percent"], 0)
        self.assertEqual(result["all_comps"], {"comp_a": 0, "comp_b": 0})
        self.assertEqual(result["motivator"], {"name": "-", "count": 0})
        self.assertEqual(result["demotivator"], {"name": "-", "count": 0})
        course_manager.filter.assert_not_called()


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
        self.assertLessEqual(
            query_count,
            2,
            "Количество запросов должно быть постоянным, а не расти с числом университетов.",
        )


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

        self.assertEqual(
            response.status_code,
            200,
            "Отсутствие оценок университета не должно приводить к ошибке API.",
        )