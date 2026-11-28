"""Загрузка Excel с результатами РСВ-тестирования."""

from django.db import transaction
from django.utils import timezone

from ...constants import (
    RsvCompetencies as COMP,
    RsvCourses as CUR,
    RsvMotivators as MOT,
    RsvValues as VAL,
    TableTestResults as tRES,
)
from ...models import (
    Competencecenters,
    Courseresults,
    Educationforms,
    Educationlevels,
    Educationspecialties,
    Institutions,
    Participants,
    Results,
    Studentmapping,
)
from ..dataload import clean_value, parse_gender
from .common import find_columns, iter_sheet_rows, open_workbook

SHEETS = {
    "Связь ФИО и ID": {
        "key": "rsv_id",
        "fields": ["rsv_id", "student_name", "student_gender", "email"],
    },
    "Сравнение по компетенциям": {
        "key": "part_rsv_id",
        "fields": [
            "center_name", "inst_name", "edu_level_name", "form_name", "spec_name",
            "part_rsv_id", "part_gender", "part_course_num",
            "res_year", "res_course_num", "res_high_potential", "res_summary_report",
            *COMP.list,
        ],
    },
    "Мотивационный профиль": {
        "key": "part_rsv_id",
        "fields": ["part_rsv_id", "res_year", *MOT.list],
    },
    "Ценностный профиль": {
        "key": "part_rsv_id",
        "fields": ["part_rsv_id", "res_year", *VAL.list],
    },
    "Образовательные курсы": {
        "key": "part_rsv_id",
        "fields": ["part_rsv_id", *CUR.list],
    },
}


def parse_rsv_excel(excel_file) -> dict:
    """Разбирает мультисheet-файл РСВ в словарь лист → список записей."""
    workbook = open_workbook(excel_file)
    parsed = {}

    for sheet_name, config in SHEETS.items():
        if sheet_name not in workbook.sheetnames:
            continue
        worksheet = workbook[sheet_name]
        start_row, columns = find_columns(worksheet, config["fields"])
        parsed[sheet_name] = list(
            iter_sheet_rows(worksheet, start_row, columns, config["key"])
        )

    return parsed


def load_rsv_records(parsed: dict) -> dict:
    """Загружает разобранные записи РСВ в БД. Возвращает счётчики результата."""
    counters = {
        "created": 0,
        "updated": 0,
        "mapped": 0,
        "participants_created": 0,
        "participants_updated": 0,
    }

    with transaction.atomic():
        for record in parsed.get("Связь ФИО и ID", []):
            rsv_id = clean_value(record.get("rsv_id"))
            student_name = clean_value(record.get("student_name"))
            if not rsv_id or not student_name:
                continue
            Studentmapping.objects.update_or_create(
                mapping_rsv=str(rsv_id),
                defaults={
                    "mapping_stud_name": student_name,
                    "mapping_stud_gender": parse_gender(record.get("student_gender")),
                    "mapping_created_at": timezone.now(),
                },
            )
            counters["mapped"] += 1

        for record in parsed.get("Сравнение по компетенциям", []):
            rsv = clean_value(record.get("part_rsv_id"))
            if not rsv:
                continue

            center = None
            if center_name := clean_value(record.get("center_name")):
                center, _ = Competencecenters.objects.get_or_create(center_name=center_name)
            institution = None
            if inst_name := clean_value(record.get("inst_name")):
                institution, _ = Institutions.objects.get_or_create(inst_name=inst_name)
            edu_level = None
            if level_name := clean_value(record.get("edu_level_name")):
                edu_level, _ = Educationlevels.objects.get_or_create(edu_level_name=level_name)
            edu_form = None
            if form_name := clean_value(record.get("form_name")):
                edu_form, _ = Educationforms.objects.get_or_create(edu_form_name=form_name)
            edu_specialty = None
            if spec_name := clean_value(record.get("spec_name")):
                edu_specialty, _ = Educationspecialties.objects.get_or_create(edu_spec_name=spec_name)

            participant, created = Participants.objects.get_or_create(
                part_rsv_id=str(rsv),
                defaults={
                    "part_gender": parse_gender(record.get("part_gender")),
                    "part_course_num": clean_value(record.get("part_course_num"), int),
                },
            )
            if created:
                counters["participants_created"] += 1
            else:
                Participants.objects.filter(pk=participant.pk).update(
                    part_gender=parse_gender(record.get("part_gender")),
                    part_course_num=clean_value(record.get("part_course_num"), int),
                )
                counters["participants_updated"] += 1

            result, created_res = Results.objects.update_or_create(
                res_participant=participant,
                res_year=clean_value(record.get("res_year")),
                defaults={
                    tRES.CENTER: center,
                    tRES.INSTITUTION: institution,
                    tRES.EDU_LEVEL: edu_level,
                    tRES.EDU_FORM: edu_form,
                    tRES.EDU_SPEC: edu_specialty,
                    tRES.COURSE_NUM: clean_value(record.get("res_course_num"), int),
                    tRES.POTENTIAL: clean_value(record.get("res_high_potential"), int),
                    tRES.REPORT: clean_value(record.get("res_summary_report")),
                },
            )

            comp_updates = {
                comp: value
                for comp in COMP.list
                if (value := clean_value(record.get(comp), int)) is not None
            }
            if comp_updates:
                Results.objects.filter(pk=result.pk).update(**comp_updates)

            counters["created" if created_res else "updated"] += 1

        for record in parsed.get("Мотивационный профиль", []):
            counters["updated"] += _update_score_fields(record, MOT.list, float)

        for record in parsed.get("Ценностный профиль", []):
            counters["updated"] += _update_score_fields(record, VAL.list, int)

        for record in parsed.get("Образовательные курсы", []):
            rsv = clean_value(record.get("part_rsv_id"))
            if not rsv:
                continue
            try:
                participant = Participants.objects.get(part_rsv_id=str(rsv))
            except Participants.DoesNotExist:
                continue
            course_defaults = {
                course: value
                for course in CUR.list
                if (value := clean_value(record.get(course), float)) is not None
            }
            if course_defaults:
                _, created_course = Courseresults.objects.update_or_create(
                    course_participant=participant,
                    defaults=course_defaults,
                )
                counters["created" if created_course else "updated"] += 1

    return counters


def _update_score_fields(record: dict, fields, value_type) -> int:
    """Обновляет мотиваторы/ценности участника за указанный год."""
    rsv = clean_value(record.get("part_rsv_id"))
    if not rsv:
        return 0
    try:
        participant = Participants.objects.get(part_rsv_id=str(rsv))
    except Participants.DoesNotExist:
        return 0

    updates = {
        field: value
        for field in fields
        if (value := clean_value(record.get(field), value_type)) is not None
    }
    if not updates:
        return 0

    return Results.objects.filter(
        res_participant=participant,
        res_year=clean_value(record.get("res_year")),
    ).update(**updates)
