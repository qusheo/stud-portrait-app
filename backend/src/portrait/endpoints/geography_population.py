"""Read-only student population statistics for the geography DOCX report."""

import json
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path


def normalize_name(value):
    return re.sub(r"[^а-яa-z0-9]", "", (value or "").casefold().replace("ё", "е"))


def institution_key(value):
    # Remove legal form only at the start; the complete branch name is retained.
    value = (value or "").casefold().replace("ё", "е").strip(' \"«»')
    value = re.sub(
        r"^(?:федеральное\s+государственное\s+(?:бюджетное|автономное|казенное)\s+"
        r"(?:образовательное\s+учреждение|образовательная\s+организация)\s+"
        r"высшего\s+(?:профессионального\s+)?образования|"
        r"фг[баки]оу\s*в(?:п)?о)\s*", "", value,
    )
    return normalize_name(value)


@lru_cache(maxsize=1)
def load_region_catalog():
    path = Path(__file__).with_name("data") / "institution_regions.json"
    return json.loads(path.read_text(encoding="utf-8"))["records"]


def build_population_summary(year, amounts, institutions, tests, catalog):
    """Use source IDs for report deduplication; never merge or change DB rows.

    Year means the stored monitoring edition, matching the dashboard convention.
    Only a unique directory match is accepted. Conflicting counts are excluded.
    """
    population_year = int(str(year).split("/")[-1])
    exact, core = defaultdict(set), defaultdict(set)
    for entry in catalog:
        if entry["year"] != population_year:
            continue
        identity = (entry["source_id"], entry["region"])
        exact[normalize_name(entry["name"])].add(identity)
        core[institution_key(entry["name"])].add(identity)

    def resolve(name):
        choices = exact.get(normalize_name(name)) or core.get(institution_key(name), set())
        return next(iter(choices)) if len(choices) == 1 else None

    names = {row["inst_id"]: row["inst_name"] for row in institutions}
    identities = {}
    for inst_id, name in names.items():
        matched = resolve(name)
        identities[inst_id] = (("source", *matched), matched[1]) if matched else (
            ("db", inst_id), None
        )

    groups = {}
    invalid = []
    for row in amounts:
        inst_id = row["institution_id"]
        name = names.get(inst_id, f"ID {inst_id}")
        value = row["amount_of_students"]
        if value is None or value < 0:
            invalid.append({"name": name, "reason": "Некорректная численность"})
            continue
        key, region = identities.get(inst_id, (("db", inst_id), None))
        group = groups.setdefault(key, {"name": name, "region": region, "values": set(), "rows": 0})
        group["values"].add(value)
        group["rows"] += 1

    tested = defaultdict(set)
    all_tested = set()
    for row in tests:
        participant = row["res_participant_id"]
        if participant is None:
            continue
        all_tested.add(participant)
        inst_id = row["res_institution_id"]
        if inst_id in identities:
            tested[identities[inst_id][0]].add(participant)

    regions, issues = {}, list(invalid)
    covered_tested = set()
    duplicates = 0
    conflicts = 0
    for key, group in groups.items():
        if len(group["values"]) != 1:
            conflicts += 1
            issues.append({"name": group["name"], "reason": "Разная численность у дублей: " + ", ".join(map(str, sorted(group["values"])))})
            continue
        duplicates += group["rows"] - 1
        region = group["region"] or "Регион не определён"
        entry = regions.setdefault(region, {"region": region, "institutions": 0, "population": 0, "tested": set()})
        entry["institutions"] += 1
        entry["population"] += next(iter(group["values"]))
        entry["tested"].update(tested[key])
        covered_tested.update(tested[key])
        if group["region"] is None:
            issues.append({"name": group["name"], "reason": "Нет однозначного соответствия в справочнике регионов"})

    rows = []
    for entry in regions.values():
        count = len(entry["tested"])
        rows.append({**entry, "tested": count,
                     "coverage": count / entry["population"] * 100 if entry["population"] else None})
    rows.sort(key=lambda row: (row["region"] == "Регион не определён", row["region"]))
    return {
        "year": population_year, "rows": rows, "input_rows": len(amounts),
        "population": sum(row["population"] for row in rows),
        "institutions": sum(row["institutions"] for row in rows),
        "tested": len(covered_tested), "tested_without_population": len(all_tested - covered_tested),
        "duplicates": duplicates, "conflicts": conflicts, "issues": issues,
    }


def get_population_summary(year):
    from portrait.models import Institutions, Results, StudentsAmount

    population_year = int(str(year).split("/")[-1])
    amounts = list(StudentsAmount.objects.filter(year=population_year).values("institution_id", "amount_of_students"))
    tests = list(Results.objects.filter(res_year=year).values("res_institution_id", "res_participant_id").distinct())
    institution_ids = {row["institution_id"] for row in amounts}
    institution_ids.update(row["res_institution_id"] for row in tests if row["res_institution_id"] is not None)
    institutions = list(Institutions.objects.filter(inst_id__in=institution_ids).values("inst_id", "inst_name"))
    return build_population_summary(year, amounts, institutions, tests, load_region_catalog())


def append_population_section(doc, summary):
    from docx.oxml import OxmlElement

    def repeat_header(table):
        header = OxmlElement("w:tblHeader")
        table.rows[0]._tr.get_or_add_trPr().append(header)

    doc.add_page_break()
    doc.add_heading("7. Численность студентов по регионам", level=1)
    doc.add_paragraph(
        f"Численность взята из students_amounts за {summary['year']} год. "
        "Для учебного года используется год его окончания, как на дашборде. "
        "Год в таблице соответствует выпуску мониторинга; фактический период данных "
        "может отличаться от учебного года."
    )
    doc.add_paragraph(
        "Регион определяется по месту расположения вуза или филиала из справочника "
        "мониторинга, а не по центру тестирования. Источник: https://monitoring.miccedu.ru/?m=vpo. "
        "Вузы сопоставляются по полному названию с нормализацией оформления и организационной формы; "
        "неоднозначные соответствия отмечены отдельно."
    )
    if not summary["input_rows"]:
        doc.add_paragraph("Нет данных о численности за этот год. Другие годы автоматически не подставлялись.")
        return
    doc.add_paragraph(
        f"Учтено вузов и филиалов: {summary['institutions']}. "
        f"Общая численность: {summary['population']:,}. "
        f"Повторных одинаковых записей не учтено: {summary['duplicates']}. "
        f"Вузов с конфликтующими значениями исключено: {summary['conflicts']}.".replace(",", " ")
    )
    table = doc.add_table(rows=1, cols=5)
    table.style = "Table Grid"
    repeat_header(table)
    for cell, text in zip(table.rows[0].cells, ["Регион", "Вузов и филиалов", "Всего студентов", "Прошли тесты", "Охват"]):
        cell.text = text
    for row in summary["rows"]:
        coverage = row["coverage"]
        small = coverage is not None and coverage < 1
        values = [row["region"], str(row["institutions"]), f"{row['population']:,}".replace(",", " "),
                  "—" if small else str(row["tested"]),
                  "Нет данных" if coverage is None else "<1%" if small else f"{coverage:.1f}%"]
        for cell, text in zip(table.add_row().cells, values):
            cell.text = text
    doc.add_paragraph(
        "Прошедшие тестирование — уникальные участники с результатами за выбранный учебный год "
        "только в вузах, для которых учтена численность. Повторные результаты одного участника "
        "внутри региона считаются один раз. Для охвата менее 1% точное количество не раскрывается. "
        "Значение выше 100% указывает на несогласованность периодов или данных и требует проверки."
    )
    doc.add_paragraph(
        f"Участников без сопоставленной численности: {summary['tested_without_population']}. "
        "Они не включены в расчёт охвата. Отсутствие результатов означает 0 прошедших "
        "в пределах имеющихся данных, а не подтверждение отсутствия тестирований вообще."
    )
    if summary["issues"]:
        doc.add_heading("Вузы и записи требующие проверки", level=2)
        doc.add_paragraph(
            f"Всего записей для проверки: {len(summary['issues'])}. "
            "Ниже приведены первые 50. Численность вузов без региона учтена в отдельной строке таблицы; "
            "конфликтующие и некорректные значения исключены из итогов."
        )
        table = doc.add_table(rows=1, cols=2)
        table.style = "Table Grid"
        repeat_header(table)
        table.rows[0].cells[0].text = "Вуз или филиал"
        table.rows[0].cells[1].text = "Причина"
        for issue in summary["issues"][:50]:
            cells = table.add_row().cells
            cells[0].text, cells[1].text = issue["name"], issue["reason"]
