import json

from django.test import Client
from django.urls import reverse

from portrait.models import (
    Competencecenters,
    Institutions,
    Participants,
    Results,
    Specialties,
)

from ..base import BaseTestCase


def post_json(client, url_name, body, **kwargs):
    return client.post(
        reverse(url_name, **kwargs),
        data=json.dumps(body),
        content_type="application/json",
    )


class DataSessionTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def create_session(self):
        response = post_json(self.client, "datasesh_new", {})
        self.assertEqual(response.status_code, 200)
        return response.json()["session"]

    def test_create_session(self):
        session = self.create_session()
        self.assertTrue(session["id"])
        self.assertEqual(session["start"], 0)
        self.assertEqual(session["end"], 1000)
        self.assertEqual(session["filters"], [])
        self.assertEqual(session["total_count"], 0)

    def test_update_filters(self):
        session = self.create_session()
        filters = [{
            "id": "f1",
            "type": "categorial",
            "field": "res_year",
            "categories": ["2024/2025"],
        }]
        response = post_json(
            self.client, "datasesh_update_filters",
            {"session_id": session["id"], "filters": filters},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["session"]["filters"][0]["categories"], ["2024/2025"]
        )

    def test_update_filters_invalid(self):
        session = self.create_session()
        response = post_json(
            self.client, "datasesh_update_filters",
            {"session_id": session["id"], "filters": [{"type": "unknown"}]},
        )
        self.assertEqual(response.status_code, 400)

    def test_update_columns(self):
        session = self.create_session()
        response = post_json(
            self.client, "datasesh_update_columns",
            {"session_id": session["id"], "columns": ["res_year"]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["session"]["columns"], ["res_year"])

    def test_update_columns_invalid(self):
        session = self.create_session()
        response = post_json(
            self.client, "datasesh_update_columns",
            {"session_id": session["id"], "columns": "res_year"},
        )
        self.assertEqual(response.status_code, 400)

    def test_update_window(self):
        session = self.create_session()
        response = post_json(
            self.client, "datasesh_update_window",
            {"session_id": session["id"], "start": 10, "end": 20},
        )
        self.assertEqual(response.status_code, 200)
        updated = response.json()["session"]
        self.assertEqual((updated["start"], updated["end"]), (10, 20))

    def test_update_window_invalid(self):
        session = self.create_session()
        response = post_json(
            self.client, "datasesh_update_window",
            {"session_id": session["id"], "start": 20, "end": 10},
        )
        self.assertEqual(response.status_code, 400)

    def test_missing_session_id(self):
        response = post_json(self.client, "datasesh_update_filters", {"filters": []})
        self.assertEqual(response.status_code, 400)

    def test_unknown_session(self):
        response = post_json(
            self.client, "datasesh_update_filters",
            {"session_id": "no-such-id", "filters": []},
        )
        self.assertEqual(response.status_code, 404)


class ExtractDataTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.institution = Institutions.objects.create(inst_name="ТюмГУ")
        self.center = Competencecenters.objects.create(center_name="Центр 1")
        self.specialty = Specialties.objects.create(spec_name="Информатика")
        self.results = []
        for index in range(3):
            participant = Participants.objects.create(
                part_rsv_id=f"DS{index:03d}", part_gender=1
            )
            self.results.append(Results.objects.create(
                res_participant=participant,
                res_year="2024/2025",
                res_course=2,
                res_institution=self.institution,
                res_center=self.center,
                res_edu_specialty=self.specialty,
                res_comp_leadership=500 + index * 50,
            ))

    def test_extract_all(self):
        response = post_json(self.client, "datasesh_extract_data", {})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["filtered_count"], 3)
        self.assertEqual(payload["shown_count"], 3)
        row = payload["results"][0]
        self.assertEqual(row["institution"], "ТюмГУ")
        self.assertEqual(row["specialty"], "Информатика")
        self.assertIn("res_comp_leadership", row["competences"])

    def test_extract_with_categorial_filter(self):
        other = Participants.objects.create(part_rsv_id="DS999")
        Results.objects.create(res_participant=other, res_year="2023/2024", res_course=1)

        response = post_json(
            self.client, "datasesh_extract_data",
            {
                "filters": [{
                    "id": "f1", "type": "categorial",
                    "field": "res_year", "categories": ["2024/2025"],
                }],
            },
        )
        payload = response.json()
        self.assertEqual(payload["filtered_count"], 3)
        self.assertEqual(
            payload["available_values"]["res_year"], ["2024/2025"]
        )

    def test_extract_with_numeric_filter(self):
        response = post_json(
            self.client, "datasesh_extract_data",
            {
                "filters": [{
                    "id": "f2", "type": "numeric",
                    "field": "res_comp_leadership", "min": 550, "max": 700,
                }],
            },
        )
        self.assertEqual(response.json()["filtered_count"], 2)

    def test_extract_window(self):
        response = post_json(
            self.client, "datasesh_extract_data", {"start": 1, "end": 2}
        )
        payload = response.json()
        self.assertEqual(payload["filtered_count"], 3)
        self.assertEqual(payload["shown_count"], 1)

    def test_extract_invalid_window(self):
        response = post_json(
            self.client, "datasesh_extract_data", {"start": 5, "end": 2}
        )
        self.assertEqual(response.status_code, 400)

    def test_extract_invalid_filters(self):
        response = post_json(
            self.client, "datasesh_extract_data", {"filters": "not-a-list"}
        )
        self.assertEqual(response.status_code, 400)


class ExportAndGroupTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.results = []
        for index, year in enumerate(("2023/2024", "2024/2025")):
            participant = Participants.objects.create(part_rsv_id=f"EXP{index:03d}")
            self.results.append(Results.objects.create(
                res_participant=participant,
                res_year=year,
                res_course=2,
                res_comp_leadership=500 + index * 100,
                res_mot_purpose=550,
            ))

    def test_export_requires_ids(self):
        response = post_json(self.client, "datasesh_export_selected", {})
        self.assertEqual(response.status_code, 400)

    def test_export_returns_xlsx(self):
        response = post_json(
            self.client, "datasesh_export_selected",
            {"selected_ids": [self.results[0].res_id]},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        self.assertTrue(response.content.startswith(b"PK"))

    def test_group_requires_ids_and_column(self):
        response = post_json(self.client, "datasesh_group_selected", {})
        self.assertEqual(response.status_code, 400)

        response = post_json(
            self.client, "datasesh_group_selected",
            {"selected_ids": [self.results[0].res_id]},
        )
        self.assertEqual(response.status_code, 400)

    def test_group_by_year(self):
        response = post_json(
            self.client, "datasesh_group_selected",
            {
                "selected_ids": [r.res_id for r in self.results],
                "groupping_column": "res_year",
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["groups"], ["2023/2024", "2024/2025"])
        leadership = payload["grouped_data"]["competences"]["res_comp_leadership"]
        self.assertEqual(leadership["groups"], ["2023/2024", "2024/2025"])
        self.assertEqual(leadership["values"], [500.0, 600.0])


class SessionStatsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_stats_with_filters(self):
        session = post_json(self.client, "datasesh_new", {}).json()["session"]

        institution = Institutions.objects.create(inst_name="ТюмГУ")
        center = Competencecenters.objects.create(center_name="Центр 1")
        participant = Participants.objects.create(part_rsv_id="ST001")
        Results.objects.create(
            res_participant=participant,
            res_year="2024/2025",
            res_course=2,
            res_institution=institution,
            res_center=center,
            res_comp_leadership=500,
        )

        response = post_json(
            self.client, "datasesh_count_stats", {"session_id": session["id"]}
        )
        self.assertEqual(response.status_code, 200)
        stats = response.json()["stats"]
        self.assertEqual(stats["totalParticipants"], 1)
        self.assertEqual(stats["totalTests"], 1)
        self.assertEqual(stats["uniqueInstitutions"], 1)
        self.assertEqual(stats["uniqueCenters"], 1)
        self.assertEqual(stats["testsByYear"]["years"], ["2024/2025"])
        self.assertEqual(
            stats["participantsByInstitution"]["institutions"], ["ТюмГУ"]
        )
        leadership = next(
            c for c in stats["competencesByYear"] if c["name"] == "Лидерство"
        )
        self.assertEqual(leadership["values"], [500.0])
