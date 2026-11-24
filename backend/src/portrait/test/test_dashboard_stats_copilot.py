import json
from types import SimpleNamespace
from unittest.mock import Mock, MagicMock, call, patch

import django
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "studportrait.settings")
django.setup()

from django.test import RequestFactory, SimpleTestCase
from portrait.endpoints.statisticsService import stat


def make_metrics(total_avg, all_comps, course_percent=0, amount_in=0, students_all=0):
    return {
        "total_avg": total_avg,
        "course_percent": course_percent,
        "all_comps": all_comps,
        "motivator": {"name": "mot_a", "count": 50},
        "demotivator": {"name": "mot_b", "count": 25},
        "participated": {
            "amount_in": amount_in,
            "students_all": students_all,
        },
    }


class DashboardStatsContractTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def call_dashboard(self, params, metric_results):
        results_queryset = MagicMock()
        results_queryset.values.return_value.annotate.return_value = []
        results_manager = SimpleNamespace(
            filter=Mock(return_value=results_queryset)
        )

        with (
            patch.object(
                stat,
                "Results",
                SimpleNamespace(objects=results_manager),
            ),
            patch.object(
                stat,
                "COMP",
                SimpleNamespace(list=["comp_a", "comp_b"]),
            ),
            patch.object(
                stat,
                "get_year_metrics",
                side_effect=metric_results,
            ) as get_year_metrics,
            patch.object(
                stat,
                "get_competency_stats_courses",
                return_value=[],
            ),
        ):
            request = self.factory.get("/portrait/dashboard-stats/", params)
            response = stat.get_dashboard_stats(request)

        return response, get_year_metrics

    def test_selected_year_filters_and_response_structure(self):
        current = make_metrics(
            60,
            {"comp_a": 80, "comp_b": 40},
            course_percent=35,
            amount_in=10,
            students_all=100,
        )
        previous = make_metrics(
            30,
            {"comp_a": 40, "comp_b": 20},
            course_percent=20,
            amount_in=8,
            students_all=90,
        )
        filters = {
            "res_institution__inst_name": "Университет 1",
            "res_edu_specialty__spec_name": "Информатика",
        }

        response, get_year_metrics = self.call_dashboard(
            {
                "institute": "Университет 1",
                "specialty": "Информатика",
                "year": "2025/2026",
            },
            [current, previous],
        )

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content)

        final_filters = {
            **filters,
            "res_year": "2025/2026",
        }
        get_year_metrics.assert_has_calls([
            call("2025/2026", final_filters),
            call("2024/2025", final_filters),
        ])
        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["year"], "2026")
        self.assertEqual(
            payload["col1"]["avg_lvl"],
            {"val": 60, "prev": 30},
        )
        self.assertEqual(payload["col1"]["growth"], {"val": 100.0, "prev": 0})
        self.assertEqual(
            payload["col2"]["participated"],
            {"amount_in": 10, "students_all": 100},
        )
        self.assertEqual(
            set(payload),
            {"ok", "col1", "col2", "col3", "year", "radar"},
        )

    def test_missing_year_uses_current_and_previous_defaults(self):
        metrics = make_metrics(
            0,
            {"comp_a": 0, "comp_b": 0},
        )

        response, get_year_metrics = self.call_dashboard(
            {},
            [metrics, metrics],
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content)["year"], "2026")
        final_filters = {"res_year": "2025/2026"}
        get_year_metrics.assert_has_calls([
            call("2025/2026", final_filters),
            call("2024/2025", final_filters),
        ])

    def call_year_metrics(self, aggregate_data, courses_count=0, competencies=None, motivators=None):
        queryset = MagicMock()
        queryset.aggregate.return_value = aggregate_data

        students_amount_queryset = MagicMock()
        students_amount_queryset.aggregate.return_value = {"total": 0}

        course_queryset = MagicMock()
        course_queryset.count.return_value = courses_count

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

    def test_average_uses_only_competencies_with_values(self):
        result = self.call_year_metrics(
            {
                "total": 2,
                "students": 2,
                "avg_comp_a": 80,
                "avg_comp_b": None,
            },
            competencies=["comp_a", "comp_b"],
        )

        self.assertEqual(result["all_comps"], {"comp_a": 80, "comp_b": 0})
        self.assertEqual(result["total_avg"], 80)

    def test_course_percentage_is_capped_at_one_hundred(self):
        result = self.call_year_metrics(
            {
                "total": 2,
                "students": 2,
                "avg_comp_a": 70,
            },
            courses_count=3,
        )

        self.assertEqual(result["course_percent"], 100)

    def test_missing_motivator_values_do_not_reduce_percentage(self):
        result = self.call_year_metrics(
            {
                "total": 2,
                "students": 2,
                "avg_comp_a": 70,
                "high_0": 1,
                "low_0": 0,
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