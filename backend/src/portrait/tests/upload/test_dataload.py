import json
from io import BytesIO

import openpyxl
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.urls import reverse

from portrait.endpoints.dataload import clean_value, convert_grade_to_int, parse_gender
from portrait.models import (
    Datauploadtemplate,
    Participants,
    Results,
    Studentmapping,
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
        "import.xlsx",
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def post_import(client, excel_file, config):
    return client.post(
        reverse("dataload_import_excel"),
        data={"file": excel_file, "config_json": json.dumps(config)},
    )


class ImportExcelTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_no_file(self):
        response = self.client.post(
            reverse("dataload_import_excel"),
            data={"config_json": json.dumps({"sheets": []})},
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["ok"])

    def test_missing_config(self):
        excel = make_xlsx({"Связь ФИО и ID": [["R1", "Иванов Иван"]]})
        response = self.client.post(reverse("dataload_import_excel"), data={"file": excel})
        self.assertEqual(response.status_code, 400)

    def test_invalid_config_json(self):
        excel = make_xlsx({"Связь ФИО и ID": [["R1", "Иванов Иван"]]})
        response = self.client.post(
            reverse("dataload_import_excel"),
            data={"file": excel, "config_json": "not json"},
        )
        self.assertEqual(response.status_code, 400)

    def test_import_name_mapping(self):
        excel = make_xlsx({
            "Связь ФИО и ID": [
                ["RSV-1", "Иванов Иван Иванович", "М"],
                ["RSV-2", "Петрова Анна Сергеевна", "Ж"],
            ]
        })
        config = {
            "sheets": [{
                "name": "Связь ФИО и ID",
                "start_row": 1,
                "columns": {"rsv_id": "A", "student_name": "B", "student_gender": "C"},
            }]
        }

        response = post_import(self.client, excel, config)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["mapped"], 2)
        mapping = Studentmapping.objects.get(mapping_rsv="RSV-2")
        self.assertEqual(mapping.mapping_stud_name, "Петрова Анна Сергеевна")
        self.assertEqual(mapping.mapping_stud_gender, "2")

    def test_import_competency_results(self):
        excel = make_xlsx({
            "Сравнение по компетенциям": [
                ["Центр 1", "ТюмГУ", "RSV-1", "2024/2025", 2, 550, 610],
                ["Центр 1", "ТюмГУ", "RSV-1", "2024/2025", 2, 560, 620],
            ]
        })
        config = {
            "sheets": [{
                "name": "Сравнение по компетенциям",
                "start_row": 1,
                "columns": {
                    "center_name": "A", "inst_name": "B",
                    "part_rsv_id": "C", "res_year": "D", "res_course_num": "E",
                    "res_comp_leadership": "F", "res_comp_planning": "G",
                },
            }]
        }

        response = post_import(self.client, excel, config)

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["created"], 1)
        self.assertEqual(payload["updated"], 1)
        participant = Participants.objects.get(part_rsv_id="RSV-1")
        result = Results.objects.get(res_participant=participant, res_year="2024/2025")
        self.assertEqual(result.res_comp_leadership, 560)
        self.assertEqual(result.res_comp_planning, 620)
        self.assertEqual(result.res_course, 2)

    def test_missing_sheet_is_skipped(self):
        excel = make_xlsx({"Связь ФИО и ID": [["RSV-1", "Иванов Иван"]]})
        config = {
            "sheets": [{
                "name": "Несуществующий лист",
                "start_row": 1,
                "columns": {"rsv_id": "A"},
            }]
        }

        response = post_import(self.client, excel, config)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["mapped"], 0)

    def test_wrong_method(self):
        response = self.client.get(reverse("dataload_import_excel"))
        self.assertEqual(response.status_code, 405)


class ExpectedFieldsTests(BaseTestCase):
    def test_expected_fields_structure(self):
        response = Client().get(reverse("dataload_expected_fields"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertIn("Связь ФИО и ID", payload)
        self.assertIn("rsv_id", payload["Связь ФИО и ID"])
        self.assertIn("res_comp_leadership", payload["Сравнение по компетенциям"])
        self.assertIn("res_mot_purpose", payload["Мотивационный профиль"])
        self.assertIn("res_val_health", payload["Ценностный профиль"])


class TemplateManagementTests(BaseTestCase):
    def setUp(self):
        self.client = Client()

    def test_get_templates_empty(self):
        response = self.client.get(reverse("dataload_templates"))
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["templates"], [])

    def test_save_template(self):
        response = self.client.post(
            reverse("dataload_template_save"),
            data=json.dumps({
                "name": "New Template",
                "config": {"sheets": []},
                "description": "Test Description",
            }),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["name"], "New Template")
        self.assertTrue(payload["created"])

    def test_save_template_updates_existing(self):
        config = {"sheets": [{"name": "Лист"}]}
        for _ in range(2):
            response = self.client.post(
                reverse("dataload_template_save"),
                data=json.dumps({"name": "T", "config": config}),
                content_type="application/json",
            )
        self.assertFalse(response.json()["created"])
        self.assertEqual(Datauploadtemplate.objects.filter(template_name="T").count(), 1)

    def test_save_template_requires_name_and_config(self):
        for body in ({"config": {}}, {"name": "T"}):
            response = self.client.post(
                reverse("dataload_template_save"),
                data=json.dumps(body),
                content_type="application/json",
            )
            self.assertEqual(response.status_code, 400)

    def test_get_templates_after_save(self):
        Datauploadtemplate.objects.create(
            template_name="T1", template_config={"sheets": []}
        )
        response = self.client.get(reverse("dataload_templates"))
        payload = response.json()
        self.assertEqual(len(payload["templates"]), 1)
        template = payload["templates"][0]
        self.assertEqual(template["name"], "T1")
        self.assertEqual(template["config"], {"sheets": []})

    def test_delete_template(self):
        template = Datauploadtemplate.objects.create(
            template_name="T1", template_config={"sheets": []}
        )
        response = self.client.delete(
            reverse("dataload_template_delete", args=[template.template_id])
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            Datauploadtemplate.objects.filter(pk=template.template_id).exists()
        )

    def test_delete_missing_template(self):
        response = self.client.delete(
            reverse("dataload_template_delete", args=[999999])
        )
        self.assertEqual(response.status_code, 404)


class DataloadUtilitiesTests(BaseTestCase):
    def test_parse_gender(self):
        self.assertEqual(parse_gender("М"), 1)
        self.assertEqual(parse_gender("мужской"), 1)
        self.assertEqual(parse_gender("Female"), 2)
        self.assertEqual(parse_gender("ж"), 2)
        self.assertIsNone(parse_gender(None))
        self.assertIsNone(parse_gender("неизвестно"))

    def test_clean_value_empty_markers(self):
        for marker in ("", "-", "—", "н/д", "N/A", None):
            self.assertIsNone(clean_value(marker), marker)

    def test_clean_value_int(self):
        self.assertEqual(clean_value("550", int), 550)
        self.assertEqual(clean_value("550.0", int), 550)
        self.assertEqual(clean_value("55,5", int), 55)
        self.assertIsNone(clean_value("abc", int))

    def test_clean_value_float(self):
        self.assertEqual(clean_value("4,5", float), 4.5)
        self.assertEqual(clean_value(4, float), 4.0)

    def test_convert_grade_to_int(self):
        self.assertEqual(convert_grade_to_int("отл."), 5)
        self.assertEqual(convert_grade_to_int("хорошо"), 4)
        self.assertEqual(convert_grade_to_int("удовл."), 3)
        self.assertEqual(convert_grade_to_int("неудовл."), 2)
        self.assertEqual(convert_grade_to_int("не явился"), 1)
        self.assertEqual(convert_grade_to_int("5"), 5)
        self.assertIsNone(convert_grade_to_int(None))
        self.assertIsNone(convert_grade_to_int("превосходно"))
        self.assertIsNone(convert_grade_to_int("7"))
