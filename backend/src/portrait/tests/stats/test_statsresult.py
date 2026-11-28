from django.test import Client
from django.urls import reverse

from portrait.constants import CENTERS_REGIONS, RsvMotivators as MOT
from portrait.models import (
    Competencecenters,
    Courseresults,
    Institutions,
    Participants,
    Results,
    Specialties,
)

from ..base import BaseTestCase


class CoursesEndpointTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.institution = Institutions.objects.create(inst_name="ТюмГУ")
        self.participant = Participants.objects.create(part_rsv_id="CRS001")
        Results.objects.create(
            res_participant=self.participant,
            res_year="2024/2025",
            res_course=2,
            res_institution=self.institution,
        )
        Courseresults.objects.create(
            course_participant=self.participant,
            course_leadership=4.5,
        )

    def test_courses_list(self):
        response = self.client.get(reverse("courses"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["courses"]), 1)
        course = payload["courses"][0]
        self.assertEqual(course["course_leadership"], 4.5)
        self.assertEqual(course["participant"]["part_rsv_id"], "CRS001")

    def test_courses_filtered_by_institution(self):
        other = Participants.objects.create(part_rsv_id="CRS002")
        Results.objects.create(res_participant=other, res_year="2024/2025", res_course=1)
        Courseresults.objects.create(course_participant=other)

        response = self.client.get(
            reverse("courses"), {"institution_ids[]": [self.institution.inst_id]}
        )
        courses = response.json()["courses"]
        self.assertEqual(len(courses), 1)
        self.assertEqual(courses[0]["participant"]["part_rsv_id"], "CRS001")

        response = self.client.get(reverse("courses"), {"institution_ids[]": [999999]})
        self.assertEqual(response.json()["courses"], [])


class InstitutionDirectionsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.institution = Institutions.objects.create(inst_name="ТюмГУ")
        self.specialty = Specialties.objects.create(spec_name="Информатика")

    def test_all_directions_without_institutions(self):
        response = self.client.get(reverse("get_institution_directions"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(
            payload["directions"],
            [{"id": self.specialty.spec_id, "name": "Информатика"}],
        )

    def test_directions_of_selected_institution(self):
        participant = Participants.objects.create(part_rsv_id="DIR001")
        Results.objects.create(
            res_participant=participant,
            res_year="2024/2025",
            res_course=2,
            res_institution=self.institution,
            res_edu_specialty=self.specialty,
        )

        response = self.client.get(
            reverse("get_institution_directions"),
            {"institution_ids": [self.institution.inst_id]},
        )
        self.assertEqual(
            response.json()["directions"],
            [{"id": self.specialty.spec_id, "name": "Информатика"}],
        )

    def test_directions_of_unknown_institution(self):
        response = self.client.get(
            reverse("get_institution_directions"), {"institution_ids": [999999]}
        )
        self.assertEqual(response.json()["directions"], [])


class FilterOptionsWithCountsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.institution = Institutions.objects.create(inst_name="ТюмГУ")
        self.specialty = Specialties.objects.create(spec_name="Информатика")
        self.participant = Participants.objects.create(part_rsv_id="FOC001")
        Results.objects.create(
            res_participant=self.participant,
            res_year="2024/2025",
            res_course=2,
            res_institution=self.institution,
            res_edu_specialty=self.specialty,
            res_comp_leadership=500,
        )

    def test_counts_structure(self):
        response = self.client.get(reverse("get_filter_options_with_counts"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        data = payload["data"]

        self.assertEqual(
            data["institutions"],
            [{"id": self.institution.inst_id, "name": "ТюмГУ", "count": 1}],
        )
        self.assertEqual(
            data["directions"],
            [{"id": self.specialty.spec_id, "name": "Информатика", "count": 1}],
        )
        self.assertEqual(
            data["courses"], [{"id": 2, "name": "2 курс", "count": 1}]
        )
        self.assertEqual(
            data["test_attempts"],
            [{"id": 1, "name": "1 прохождение", "count": 1}],
        )
        leadership = next(
            c for c in data["competencies"] if c["id"] == "res_comp_leadership"
        )
        self.assertEqual(leadership["count"], 1)
        self.assertEqual(len(data["students"]), 1)
        self.assertEqual(data["max_attempts"], 1)

    def test_cross_filtering_by_institution(self):
        other_institution = Institutions.objects.create(inst_name="Другой ВУЗ")
        other = Participants.objects.create(part_rsv_id="FOC002")
        Results.objects.create(
            res_participant=other,
            res_year="2024/2025",
            res_course=3,
            res_institution=other_institution,
        )

        response = self.client.get(
            reverse("get_filter_options_with_counts"),
            {"institution_ids[]": [self.institution.inst_id]},
        )
        data = response.json()["data"]
        self.assertEqual(data["courses"], [{"id": 2, "name": "2 курс", "count": 1}])
        self.assertEqual(data["directions"][0]["name"], "Информатика")


class CentersByRegionTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.center_name, self.region = next(
            (name, region)
            for name, region in CENTERS_REGIONS.items()
            if region is not None
        )

    def test_invalid_year(self):
        response = self.client.get(reverse("centers_by_region"), {"year": "1999/2000"})
        self.assertEqual(response.status_code, 400)

    def test_counts_aggregated_by_region(self):
        center = Competencecenters.objects.create(center_name=self.center_name)
        unknown = Competencecenters.objects.create(center_name="Без привязки к ЦК")
        for index, selected_center in enumerate((center, center, unknown)):
            participant = Participants.objects.create(part_rsv_id=f"CBR{index:03d}")
            Results.objects.create(
                res_participant=participant,
                res_year="2024/2025",
                res_course=2,
                res_center=selected_center,
            )

        response = self.client.get(reverse("centers_by_region"), {"year": "2024/2025"})
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(
            payload["data"], [{"name": self.region, "value": 2}]
        )
        self.assertEqual(payload["max_value"], 2)
        self.assertEqual(payload["total_centers"], 1)

    def test_year_without_data(self):
        response = self.client.get(reverse("centers_by_region"), {"year": "2024/2025"})
        payload = response.json()
        self.assertEqual(payload["data"], [])
        self.assertEqual(payload["max_value"], 0)


class MotivatorStatisticsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        for index, score in enumerate((300, 700)):
            participant = Participants.objects.create(part_rsv_id=f"MST{index:03d}")
            Results.objects.create(
                res_participant=participant,
                res_year="2024/2025",
                res_course=1,
                res_mot_purpose=score,
            )

    def test_group_by_course(self):
        response = self.client.get(
            reverse("motivator_statistics"), {"group_by": "course"}
        )
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["data"]), 1)
        course = payload["data"][0]
        self.assertEqual(course["name"], "1 курс")
        self.assertEqual(course["total_students"], 2)
        purpose = course["motivators"]["res_mot_purpose"]
        self.assertEqual(purpose["motivator_percent"], 50.0)
        self.assertEqual(purpose["demotivator_percent"], 50.0)

    def test_invalid_group_by(self):
        response = self.client.get(
            reverse("motivator_statistics"), {"group_by": "weird"}
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["ok"])

    def test_motivator_fields_cover_all_constants(self):
        response = self.client.get(
            reverse("motivator_statistics"), {"group_by": "course"}
        )
        course = response.json()["data"][0]
        self.assertEqual(set(course["motivators"].keys()), set(MOT.list))
