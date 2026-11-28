"""Загрузка Excel с оценками успеваемости участников."""

from django.db import transaction

from ...models import (
    Academicperformances,
    Educationdisciplines,
    Participants,
    Studentmapping,
)
from ..dataload import clean_value, convert_grade_to_int
from .common import find_columns, iter_sheet_rows, open_workbook

FIELDS = [
    "student_name", "perf_year", "perf_discipline",
    "perf_current", "perf_digital", "perf_main_attestation",
    "perf_first_retake", "perf_second_retake", "perf_grade_retake", "perf_final",
]

GRADE_FIELDS = (
    "perf_main_attestation", "perf_first_retake",
    "perf_second_retake", "perf_grade_retake", "perf_final",
)


def parse_grades_excel(excel_file) -> dict:
    """Разбирает первый лист файла с оценками в список записей."""
    workbook = open_workbook(excel_file)
    worksheet = workbook[workbook.sheetnames[0]]
    start_row, columns = find_columns(worksheet, FIELDS)
    return {
        "rows": list(iter_sheet_rows(worksheet, start_row, columns, "student_name"))
    }


def load_grades_records(parsed: dict) -> dict:
    """Загружает разобранные оценки в БД. Возвращает счётчики результата."""
    counters = {"created": 0, "updated": 0, "skipped": 0}

    with transaction.atomic():
        for record in parsed.get("rows", []):
            student_name = clean_value(record.get("student_name"))
            year = clean_value(record.get("perf_year"))
            discipline_name = clean_value(record.get("perf_discipline"))
            if not student_name or not year or not discipline_name:
                counters["skipped"] += 1
                continue

            try:
                mapping = Studentmapping.objects.get(mapping_stud_name=student_name)
            except Studentmapping.DoesNotExist:
                counters["skipped"] += 1
                continue
            except Studentmapping.MultipleObjectsReturned:
                mapping = Studentmapping.objects.filter(
                    mapping_stud_name=student_name
                ).first()

            try:
                participant = Participants.objects.get(part_rsv_id=mapping.mapping_rsv)
            except Participants.DoesNotExist:
                counters["skipped"] += 1
                continue

            discipline, _ = Educationdisciplines.objects.get_or_create(
                edu_disc_name=discipline_name
            )

            defaults = {}
            current = clean_value(record.get("perf_current"), float)
            digital = clean_value(record.get("perf_digital"), float)
            if current is not None:
                defaults["perf_current"] = current
            if digital is not None:
                defaults["perf_digital"] = digital
            for field in GRADE_FIELDS:
                grade = convert_grade_to_int(clean_value(record.get(field)))
                if grade is not None:
                    defaults["perf_main" if field == "perf_main_attestation" else field] = grade

            _, created = Academicperformances.objects.update_or_create(
                perf_participant=participant,
                perf_discipline=discipline.edu_disc_name,
                perf_year=year,
                defaults=defaults,
            )
            counters["created" if created else "updated"] += 1

    return counters
