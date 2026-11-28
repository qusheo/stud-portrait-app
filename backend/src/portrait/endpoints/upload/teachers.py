"""Загрузка Excel со списком преподавателей."""

from django.db import transaction

from ...models import (
    Institutions,
    Teacher,
    TeacherDiscipline,
    TeacherEducation,
)
from ..dataload import clean_value, parse_gender
from .common import find_columns, iter_sheet_rows, open_workbook

FIELDS = [
    "name", "gender", "position", "institution",
    "academic_degree", "academic_title", "experience",
    "disciplines", "education_type", "direction", "qualification",
    "professional_development", "professional_retraining",
]

LIST_FIELDS = ("disciplines", "professional_development", "professional_retraining")


def _split_list(value) -> list:
    """Разбивает ячейку со списком значений (';' или переносы строк)."""
    text = clean_value(value)
    if not text:
        return []
    items = str(text).replace("\n", ";").split(";")
    return [item.strip() for item in items if item.strip()]


def parse_teachers_excel(excel_file) -> dict:
    """Разбирает первый лист файла с преподавателями в список записей."""
    workbook = open_workbook(excel_file)
    worksheet = workbook[workbook.sheetnames[0]]
    start_row, columns = find_columns(worksheet, FIELDS)
    return {
        "rows": list(iter_sheet_rows(worksheet, start_row, columns, "name"))
    }


def load_teachers_records(parsed: dict) -> dict:
    """Загружает разобранных преподавателей в БД. Возвращает счётчики результата."""
    counters = {"created": 0, "updated": 0, "skipped": 0}

    with transaction.atomic():
        for record in parsed.get("rows", []):
            name = clean_value(record.get("name"))
            institution_name = clean_value(record.get("institution"))
            if not name or not institution_name:
                counters["skipped"] += 1
                continue

            institution, _ = Institutions.objects.get_or_create(
                inst_name=institution_name
            )

            teacher, created = Teacher.objects.update_or_create(
                name=name,
                institution=institution,
                defaults={
                    "gender": _teacher_gender(record.get("gender")),
                    "position": clean_value(record.get("position")),
                    "academic_degree": clean_value(record.get("academic_degree")),
                    "academic_title": clean_value(record.get("academic_title")),
                    "experience": clean_value(record.get("experience"), int),
                    "professional_development": _split_list(
                        record.get("professional_development")
                    ),
                    "professional_retraining": _split_list(
                        record.get("professional_retraining")
                    ),
                },
            )

            teacher.educations.all().delete()
            education_type = clean_value(record.get("education_type"))
            direction = clean_value(record.get("direction"))
            qualification = clean_value(record.get("qualification"))
            if education_type or direction or qualification:
                TeacherEducation.objects.create(
                    teacher=teacher,
                    education_type=education_type,
                    direction=direction or "",
                    qualification=qualification or "",
                )

            teacher.discipline_rows.all().delete()
            disciplines = _split_list(record.get("disciplines"))
            TeacherDiscipline.objects.bulk_create([
                TeacherDiscipline(teacher=teacher, name=discipline)
                for discipline in dict.fromkeys(disciplines)
            ])

            counters["created" if created else "updated"] += 1

    return counters


def _teacher_gender(value):
    """Пол преподавателя: 'М'/'Ж' по числовому коду из dataload."""
    gender = parse_gender(value)
    if gender is None:
        text = clean_value(value)
        return text if text in ("М", "Ж") else None
    return {1: "М", 2: "Ж"}[gender]
