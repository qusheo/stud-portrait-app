from io import BytesIO

import openpyxl
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.urls import reverse

from portrait.models import (
    Academicperformances,
    Institutions,
    Participants,
    Results,
    Studentmapping,
    Teacher,
    User as PortraitUser,
)

from ..base import BaseTestCase


def make_xlsx(sheets):
    workbook = openpyxl.Workbook()
    for index, (name, rows) in enumerate(sheets.items()):
        worksheet = workbook.active if index == 0 else workbook.create_sheet()
        worksheet.title = name
        for row in rows:
            worksheet.append(row)
    buffer = BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(
        "upload.xlsx",
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def post_upload(client, excel_file, upload_type):
    return client.post(
        reverse("upload_import"),
        data={"file": excel_file, "type": upload_type},
    )


def create_account(account_type="admin", username="uploader"):
    django_user = get_user_model().objects.create_user(
        username=username, password="password"
    )
    PortraitUser.objects.create(
        django_user=django_user, account_type=account_type
    )
    return django_user


class UploadPermissionTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_anonymous(self):
        response = post_upload(self.client, make_xlsx({"Лист": [["name"]]}), "rsv")
        self.assertEqual(response.status_code, 401)

    def test_student_forbidden(self):
        user = create_account(
            account_type=PortraitUser.AccountType.STUDENT, username="student"
        )
        self.client.force_login(user)
        response = post_upload(self.client, make_xlsx({"Лист": [["name"]]}), "rsv")
        self.assertEqual(response.status_code, 403)

    def test_allowed_roles(self):
        for index, role in enumerate(("admin", "centre", "institution_admin")):
            with self.subTest(role=role):
                user = create_account(
                    account_type=role, username=f"allowed_{index}"
                )
                self.client.force_login(user)
                response = post_upload(
                    self.client, make_xlsx({"Лист": [["name"]]}), "teachers"
                )
                self.assertNotEqual(response.status_code, 403)
                self.assertNotEqual(response.status_code, 401)


class UploadValidationTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.client.force_login(create_account())

    def test_no_file(self):
        response = self.client.post(reverse("upload_import"), data={"type": "rsv"})
        self.assertEqual(response.status_code, 400)

    def test_unknown_type(self):
        response = post_upload(self.client, make_xlsx({"Лист": [["name"]]}), "weird")
        self.assertEqual(response.status_code, 400)
        self.assertIn("Unknown upload type", response.json()["message"])

    def test_wrong_method(self):
        response = self.client.get(reverse("upload_import"))
        self.assertEqual(response.status_code, 405)


class UploadRsvTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.client.force_login(create_account())

    def make_rsv_file(self):
        return make_xlsx({
            "Связь ФИО и ID": [
                ["RSV ID", "Student Name", "Student Gender"],
                ["RSV-1", "Иванов Иван Иванович", "М"],
            ],
            "Сравнение по компетенциям": [
                [
                    "Center Name", "Inst Name", "Part RSV ID", "RES Year",
                    "RES Course Num", "RES Comp Leadership", "res_comp_planning",
                ],
                ["Центр 1", "ТюмГУ", "RSV-1", "2024/2025", 2, 550, 610],
            ],
            "Мотивационный профиль": [
                ["part_rsv_id", "res_year", "res_mot_purpose"],
                ["RSV-1", "2024/2025", 620],
            ],
        })

    def test_import(self):
        response = post_upload(self.client, self.make_rsv_file(), "rsv")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["mapped"], 1)
        self.assertEqual(payload["participants_created"], 1)

        mapping = Studentmapping.objects.get(mapping_rsv="RSV-1")
        self.assertEqual(mapping.mapping_stud_name, "Иванов Иван Иванович")
        self.assertEqual(mapping.mapping_stud_gender, "1")

        participant = Participants.objects.get(part_rsv_id="RSV-1")
        result = Results.objects.get(res_participant=participant)
        self.assertEqual(result.res_comp_leadership, 550)
        self.assertEqual(result.res_comp_planning, 610)
        self.assertEqual(float(result.res_mot_purpose), 620.0)
        self.assertEqual(result.res_institution.inst_name, "ТюмГУ")
        self.assertEqual(result.res_course, 2)

    def test_missing_sheet_is_skipped(self):
        excel = make_xlsx({
            "Связь ФИО и ID": [
                ["rsv_id", "student_name"],
                ["RSV-9", "Сидоров Сидор"],
            ]
        })
        response = post_upload(self.client, excel, "rsv")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["mapped"], 1)


class UploadGradesTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.client.force_login(create_account())
        Studentmapping.objects.create(
            mapping_rsv="GR001", mapping_stud_name="Иванов Иван", mapping_stud_gender="1"
        )
        self.participant = Participants.objects.create(part_rsv_id="GR001")

    def test_import(self):
        excel = make_xlsx({
            "Оценки": [
                [
                    "Student Name", "Perf Year", "Perf Discipline",
                    "Perf Main Attestation", "perf_current",
                ],
                ["Иванов Иван", "2024/2025", "Математика", "отл.", 4.7],
                ["Иванов Иван", "2024/2025", "Физика", "4", None],
                ["Нет Такого", "2024/2025", "Химия", "5", 5.0],
            ]
        })

        response = post_upload(self.client, excel, "grades")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["created"], 2)
        self.assertEqual(payload["skipped"], 1)

        performance = Academicperformances.objects.get(
            perf_participant=self.participant, perf_discipline="Математика"
        )
        self.assertEqual(performance.perf_main, "5")
        self.assertEqual(float(performance.perf_current), 4.7)


class UploadTeachersTests(BaseTestCase):
    def setUp(self):
        self.client = Client()
        self.client.force_login(create_account())

    def test_import(self):
        excel = make_xlsx({
            "Преподаватели": [
                [
                    "Name", "Gender", "Position", "Institution",
                    "Academic Degree", "Disciplines", "Education Type",
                    "Direction", "Qualification", "Experience",
                ],
                [
                    "Иванова Анна Петровна", "Ж", "Доцент", "ТюмГУ",
                    "Кандидат наук", "Математика; Физика",
                    "Высшее образование", "Математика", "Математик", 10,
                ],
                ["Петров Пётр", "М", "Профессор", "ТюмГУ", None, None, None, None, None, None],
            ]
        })

        response = post_upload(self.client, excel, "teachers")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["created"], 2)

        teacher = Teacher.objects.get(name="Иванова Анна Петровна")
        self.assertEqual(teacher.gender, "Ж")
        self.assertEqual(teacher.experience, 10)
        self.assertEqual(teacher.institution.inst_name, "ТюмГУ")
        self.assertEqual(
            [row.name for row in teacher.discipline_rows.all()],
            ["Математика", "Физика"],
        )
        education = teacher.educations.get()
        self.assertEqual(education.education_type, "Высшее образование")
        self.assertEqual(education.direction, "Математика")
        self.assertEqual(education.qualification, "Математик")

    def test_skips_rows_without_institution(self):
        excel = make_xlsx({
            "Преподаватели": [
                ["name", "institution"],
                ["Без Вуза", None],
            ]
        })

        response = post_upload(self.client, excel, "teachers")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["skipped"], 1)
        self.assertFalse(
            Teacher.objects.filter(name="Без Вуза").exists()
        )
