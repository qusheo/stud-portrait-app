import json
from unittest.mock import patch

from django.test import Client
from django.urls import reverse

from portrait.models import CurriculumParseLog, DisciplineCompetencyMapping

from ..base import BaseTestCase


class SyncThread:
    def __init__(self, target=None, args=(), daemon=None):
        self._target = target
        self._args = args

    def start(self):
        self._target(*self._args)


class ParseCurriculumViewTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_starts_parser_and_returns_log_id(self):
        with (
            patch("portrait.endpoints.parsers.curriculum_end.threading.Thread", SyncThread),
            patch("portrait.endpoints.parsers.curriculum_end.parse_curriculum") as parser,
        ):
            from portrait.endpoints.parsers.disciplines_parser import DisciplineMapping, ParseResult
            parser.return_value = ParseResult(
                disciplines=[
                    DisciplineMapping(
                        name="Математика",
                        semester=1,
                        standard_competencies=["УК-1"],
                        rsv_competencies=["res_comp_info_analysis"],
                    )
                ],
                source_url="https://example/plan.pdf",
            )
            response = self.client.post(reverse("parse_curriculum"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "started")
        log = CurriculumParseLog.objects.get(pk=payload["log_id"])
        self.assertEqual(log.status, CurriculumParseLog.STATUS_SUCCESS)
        self.assertEqual(log.disciplines_saved, 1)
        self.assertTrue(
            DisciplineCompetencyMapping.objects.filter(disc_name="Математика").exists()
        )

    def test_rejects_second_run_while_parser_is_running(self):
        CurriculumParseLog.objects.create(
            status=CurriculumParseLog.STATUS_RUNNING, source_url=""
        )
        response = self.client.post(reverse("parse_curriculum"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "already_running")

    def test_custom_specialty_name_is_passed_to_parser(self):
        with (
            patch("portrait.endpoints.parsers.curriculum_end.threading.Thread", SyncThread),
            patch("portrait.endpoints.parsers.curriculum_end.parse_curriculum") as parser,
        ):
            from portrait.endpoints.parsers.disciplines_parser import ParseResult
            parser.return_value = ParseResult()
            response = self.client.post(
                reverse("parse_curriculum"),
                data=json.dumps({"specialty_name": "Прикладная математика"}),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 200)
        parser.assert_called_once()
        self.assertEqual(parser.call_args.kwargs["specialty_name"], "Прикладная математика")

    def test_wrong_method(self):
        response = self.client.get(reverse("parse_curriculum"))
        self.assertEqual(response.status_code, 405)


class ParseLogAndMappingsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_get_parse_log_returns_recent_entries(self):
        CurriculumParseLog.objects.create(
            status=CurriculumParseLog.STATUS_SUCCESS, source_url="https://example"
        )
        response = self.client.get(reverse("parse_curriculum_log"))

        self.assertEqual(response.status_code, 200)
        logs = response.json()["logs"]
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]["status"], CurriculumParseLog.STATUS_SUCCESS)
        self.assertEqual(logs[0]["source_url"], "https://example")

    def test_get_saved_mappings(self):
        DisciplineCompetencyMapping.objects.create(
            disc_name="Математика",
            rsv_competencies=["res_comp_info_analysis"],
            standard_competencies=["УК-1"],
            semester=1,
        )
        response = self.client.get(reverse("parse_curriculum_mappings"))

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["count"], 1)
        mapping = payload["mappings"][0]
        self.assertEqual(mapping["discipline"], "Математика")
        self.assertEqual(mapping["rsv_competencies"], ["res_comp_info_analysis"])
        self.assertEqual(mapping["semester"], 1)

    def test_get_saved_mappings_empty(self):
        response = self.client.get(reverse("parse_curriculum_mappings"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["count"], 0)
        self.assertEqual(payload["mappings"], [])
