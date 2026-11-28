import json

from django.test import Client
from django.urls import reverse

from portrait.constants import RsvCompetencies as COMP, RsvMotivators as MOT, RsvValues as VAL
from portrait.models import (
    Academicperformances,
    Educationspecialties,
    Institutions,
    Participants,
    Results,
    Studentmapping,
)

from ..base import BaseTestCase


def make_result(participant, year, course, institution=None, specialty=None, **scores):
    return Results.objects.create(
        res_participant=participant,
        res_year=year,
        res_course=course,
        res_institution=institution,
        res_edu_specialty=specialty,
        **scores,
    )


class ReferenceEndpointsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_get_institutions(self):
        Institutions.objects.create(inst_name="ТюмГУ")
        response = self.client.get(reverse("get_institutions"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["institutions"][0]["inst_name"], "ТюмГУ")

    def test_get_directions(self):
        Educationspecialties.objects.create(edu_spec_name="Информатика")
        response = self.client.get(reverse("get_directions"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["directions"][0]["edu_spec_name"], "Информатика")

    def test_get_disciplines_with_counts(self):
        from portrait.models import Educationdisciplines

        participant = Participants.objects.create(part_rsv_id="DISC001")
        disc = Educationdisciplines.objects.create(edu_disc_name="Математика")
        Educationdisciplines.objects.create(edu_disc_name="Физика")
        Academicperformances.objects.create(
            perf_participant=participant,
            perf_year="2024/2025",
            perf_discipline="Математика",
            perf_main="5",
        )

        response = self.client.get(reverse("get-disciplines"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["total_count"], 2)
        counts = {d["name"]: d["count"] for d in payload["disciplines"]}
        self.assertEqual(counts["Математика"], 1)
        self.assertEqual(counts["Физика"], 0)


class StudentVamTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(part_rsv_id="VAM001")

    def test_student_id_required(self):
        response = self.client.get(reverse("analyze_student_vam"))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["ok"])

    def test_no_results(self):
        response = self.client.get(
            reverse("analyze_student_vam"), {"student_id": self.participant.part_id}
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["has_data"])

    def test_single_measurement_is_not_enough(self):
        make_result(self.participant, "2024/2025", 1, res_comp_leadership=500)
        response = self.client.get(
            reverse("analyze_student_vam"), {"student_id": self.participant.part_id}
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()["has_data"])

    def test_success(self):
        make_result(self.participant, "2023/2024", 2, res_comp_leadership=500)
        make_result(self.participant, "2024/2025", 3, res_comp_leadership=580)
        response = self.client.get(
            reverse("analyze_student_vam"), {"student_id": self.participant.part_id}
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertIn("average_value_added", payload)
        self.assertEqual(
            payload["student_info"]["student_id"], str(self.participant.part_id)
        )


class CohortLgmTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.institution = Institutions.objects.create(inst_name="ТюмГУ")
        self.participants = []
        for index in range(2):
            participant = Participants.objects.create(part_rsv_id=f"COH{index:03d}")
            for course in range(1, 5):
                make_result(
                    participant,
                    f"{2020 + course}/{2021 + course}",
                    course,
                    institution=self.institution,
                    res_comp_leadership=400 + course * 30 + index * 5,
                )
            self.participants.append(participant)

    def test_success(self):
        response = self.client.post(
            reverse("analyze_cohort_lgm"),
            data=json.dumps({"competency": "res_comp_leadership"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["total_qualified_students"], 2)
        self.assertEqual(len(payload["data"]), 1)
        group = payload["data"][0]
        self.assertEqual(group["group_name"], "ТюмГУ")
        self.assertEqual(group["n_students"], 2)
        self.assertGreater(group["mean_slope"], 0)

    def test_no_data(self):
        Results.objects.all().delete()
        response = self.client.post(
            reverse("analyze_cohort_lgm"),
            data=json.dumps({"competency": "res_comp_leadership"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)
        self.assertFalse(response.json()["ok"])

    def test_get_lgm_growers_requires_group_id(self):
        response = self.client.post(
            reverse("get_lgm_growers"), data=json.dumps({}), content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_get_lgm_growers_success(self):
        response = self.client.post(
            reverse("get_lgm_growers"),
            data=json.dumps({"group_id": self.institution.inst_id}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["fast_count"] + payload["slow_count"], 2)


class DisciplineImpactEndpointsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def seed_impact_data(self, students=5, discipline="Управление проектами"):
        participants = []
        for index in range(students):
            participant = Participants.objects.create(part_rsv_id=f"IMP{index:03d}")
            make_result(participant, "2023/2024", 1, res_comp_leadership=400 + index)
            make_result(participant, "2024/2025", 2, res_comp_leadership=480 + index)
            Academicperformances.objects.create(
                perf_participant=participant,
                perf_year="2024/2025",
                perf_discipline=discipline,
                perf_main='отл.',
            )
            participants.append(participant)
        return participants

    def test_all_disciplines_impact_empty(self):
        response = self.client.get(reverse("analyze_all_disciplines_impact"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["impact_matrix"], [])
        self.assertEqual(payload["competencies_analyzed"], 6)

    def test_discipline_impact_advanced_empty(self):
        response = self.client.post(
            reverse("analyze_discipline_impact_advanced"),
            data=json.dumps({"competencies": ["res_comp_leadership"]}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["results"], [])

    def test_discipline_impact_advanced_success(self):
        self.seed_impact_data()
        response = self.client.post(
            reverse("analyze_discipline_impact_advanced"),
            data=json.dumps({
                "competencies": ["res_comp_leadership"],
                "min_students": 5,
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["competencies_analyzed"], 1)
        analysis = payload["results"][0]
        self.assertEqual(analysis["competency"], "res_comp_leadership")
        self.assertTrue(any(
            r["discipline"] == "Управление проектами" for r in analysis["results"]
        ))

    def test_discipline_impact_advanced_respects_min_students(self):
        self.seed_impact_data(students=3)
        response = self.client.post(
            reverse("analyze_discipline_impact_advanced"),
            data=json.dumps({
                "competencies": ["res_comp_leadership"],
                "min_students": 5,
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"], [])

    def test_heatmap_empty_db_returns_expected_structure(self):
        response = self.client.post(
            reverse("get_discipline_heatmap_data"),
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertIn("Управление проектами", payload["disciplines"])
        self.assertEqual(len(payload["competencies"]), 5)
        self.assertTrue(all(row["n_students"] == 0 for row in payload["data"]))


class StudentDisciplineImpactTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.participant = Participants.objects.create(part_rsv_id="SDI001")

    def test_student_id_required(self):
        response = self.client.get(reverse("analyze_student_discipline_impact"))
        self.assertEqual(response.status_code, 400)

    def test_student_not_found(self):
        response = self.client.get(
            reverse("analyze_student_discipline_impact"), {"student_id": 999999}
        )
        self.assertEqual(response.status_code, 404)

    def test_success(self):
        make_result(self.participant, "2023/2024", 1, res_comp_leadership=400)
        make_result(self.participant, "2024/2025", 2, res_comp_leadership=480)
        Academicperformances.objects.create(
            perf_participant=self.participant,
            perf_year="2024/2025",
            perf_discipline="Управление проектами",
            perf_main="5",
        )
        response = self.client.get(
            reverse("analyze_student_discipline_impact"),
            {"student_id": self.participant.part_id},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["data"]), 1)
        row = payload["data"][0]
        self.assertEqual(row["discipline"], "Управление проектами")
        self.assertEqual(row["competencies_before"]["res_comp_leadership"], 400)
        self.assertEqual(row["competencies_after"]["res_comp_leadership"], 480)


class CompetencyLevelFlowTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def seed_flow_data(self):
        for index in range(6):
            participant = Participants.objects.create(part_rsv_id=f"FLOW{index:03d}")
            make_result(participant, "2023/2024", 1, res_comp_leadership=300 + index * 60)
            make_result(participant, "2024/2025", 2, res_comp_leadership=320 + index * 60)

    def test_competency_required(self):
        response = self.client.post(
            reverse("get_competency_level_flow"),
            data=json.dumps({}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_no_scores_returns_404(self):
        response = self.client.post(
            reverse("get_competency_level_flow"),
            data=json.dumps({"competency": "res_comp_leadership"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 404)

    def test_course_flow(self):
        self.seed_flow_data()
        response = self.client.post(
            reverse("get_competency_level_flow"),
            data=json.dumps({"competency": "res_comp_leadership"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["nodes"]), 12)
        self.assertTrue(payload["links"])
        for link in payload["links"]:
            self.assertGreater(link["value"], 0)

    def test_yearly_flow(self):
        self.seed_flow_data()
        response = self.client.post(
            reverse("get_competency_level_flow_yearly"),
            data=json.dumps({"competency": "res_comp_leadership"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["nodes"]), 15)
        self.assertTrue(payload["links"])


class VamTrendDataTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.institution = Institutions.objects.create(inst_name="ТюмГУ")

    def test_no_data(self):
        response = self.client.post(
            reverse("get_vam_trend_data"), data=json.dumps({}), content_type="application/json"
        )
        self.assertEqual(response.status_code, 404)

    def test_success(self):
        for index in range(3):
            participant = Participants.objects.create(part_rsv_id=f"VT{index:03d}")
            make_result(
                participant, "2023/2024", 1,
                institution=self.institution, res_comp_leadership=400 + index * 10,
            )
            make_result(
                participant, "2024/2025", 2,
                institution=self.institution, res_comp_leadership=460 + index * 10,
            )

        response = self.client.post(
            reverse("get_vam_trend_data"),
            data=json.dumps({"competency": "res_comp_leadership"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["data"]), 1)
        group = payload["data"][0]
        self.assertEqual(group["group_name"], "ТюмГУ")
        self.assertEqual(group["courses"][0]["n"], 3)


class StudentComparisonStatsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.institution = Institutions.objects.create(inst_name="ТюмГУ")
        self.participant = Participants.objects.create(part_rsv_id="CMP001")

    def test_student_id_required(self):
        response = self.client.get(reverse("student_comparison_stats"))
        self.assertEqual(response.status_code, 400)

    def test_not_found(self):
        response = self.client.get(
            reverse("student_comparison_stats"), {"student_id": self.participant.part_id}
        )
        self.assertEqual(response.status_code, 404)

    def test_success(self):
        make_result(
            self.participant, "2024/2025", 2,
            institution=self.institution,
            res_comp_leadership=500, res_mot_purpose=600,
        )
        other = Participants.objects.create(part_rsv_id="CMP002")
        make_result(
            other, "2024/2025", 2,
            institution=self.institution,
            res_comp_leadership=400, res_mot_purpose=500,
        )

        response = self.client.get(
            reverse("student_comparison_stats"), {"student_id": self.participant.part_id}
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["data"]["student_info"]["institution"], "ТюмГУ")
        self.assertEqual(len(payload["data"]["competencies"]), len(COMP.list))
        leadership = next(
            c for c in payload["data"]["competencies"] if c["score"] == 500
        )
        self.assertEqual(leadership["percentile_institution"], 50)


class EducationProfilesComparisonTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_without_data_returns_empty(self):
        response = self.client.get(reverse("education_profiles_comparison"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"]["specialties"], [])


class BoxplotDataTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_competency_required(self):
        response = self.client.post(
            reverse("get_boxplot_data"), data=json.dumps({}), content_type="application/json"
        )
        self.assertEqual(response.status_code, 400)

    def test_insufficient_students(self):
        for index in range(3):
            participant = Participants.objects.create(part_rsv_id=f"BOX{index:03d}")
            make_result(participant, "2024/2025", 2, res_comp_leadership=500)

        response = self.client.post(
            reverse("get_boxplot_data"),
            data=json.dumps({"competency": "res_comp_leadership"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_ungrouped_boxplot(self):
        scores = [450, 470, 490, 510, 530, 550]
        for index, score in enumerate(scores):
            participant = Participants.objects.create(part_rsv_id=f"BOX{index:03d}")
            make_result(participant, "2024/2025", 2, res_comp_leadership=score)

        response = self.client.post(
            reverse("get_boxplot_data"),
            data=json.dumps({"competency": "res_comp_leadership"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertFalse(payload["grouped"])
        stats = payload["statistics"]
        self.assertEqual(stats["count"], len(scores))
        self.assertEqual(stats["min"], min(scores))
        self.assertEqual(stats["max"], max(scores))
        self.assertEqual(len(payload["all_students"]), len(scores))

    def test_grouped_by_institution(self):
        inst_a = Institutions.objects.create(inst_name="ВУЗ А")
        inst_b = Institutions.objects.create(inst_name="ВУЗ Б")
        for inst, base in ((inst_a, 400), (inst_b, 600)):
            for index in range(5):
                participant = Participants.objects.create(
                    part_rsv_id=f"GB{inst.inst_id}{index}"
                )
                make_result(
                    participant, "2024/2025", 2,
                    institution=inst, res_comp_leadership=base + index * 10,
                )

        response = self.client.post(
            reverse("get_boxplot_data"),
            data=json.dumps({
                "competency": "res_comp_leadership",
                "institution_ids": [inst_a.inst_id, inst_b.inst_id],
                "group_by": "auto",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["grouped"])
        self.assertEqual(payload["group_by"], "institution")
        self.assertEqual(len(payload["groups"]), 2)


class DuplicateAccountsTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_possible_duplicates_grouped_by_name_and_gender(self):
        Studentmapping.objects.create(
            mapping_rsv="DUP001", mapping_stud_name="Иван Иванов", mapping_stud_gender="1"
        )
        Studentmapping.objects.create(
            mapping_rsv="DUP002", mapping_stud_name="Иван Иванов", mapping_stud_gender="1"
        )
        Studentmapping.objects.create(
            mapping_rsv="SOLO01", mapping_stud_name="Пётр Петров", mapping_stud_gender="1"
        )

        response = self.client.get(reverse("possible-duplicate-accounts/"))
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(len(payload["students"]), 1)
        group = payload["students"][0]
        self.assertEqual(group["student_name"], "Иван Иванов")
        self.assertEqual(group["accounts_count"], 2)
        rsv_ids = {account["rsv_id"] for account in group["accounts"]}
        self.assertEqual(rsv_ids, {"DUP001", "DUP002"})

    def test_possible_duplicates_empty(self):
        response = self.client.get(reverse("possible-duplicate-accounts/"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["students"], [])
