"""Parse the official UTMN pedagogical staff disclosure table."""

import re
from dataclasses import dataclass

from bs4 import BeautifulSoup


SOURCE_URL = "https://sveden.utmn.ru/sveden/employees/pps/index.html"
INSTITUTION = "Тюменский государственный университет"


@dataclass(frozen=True)
class TeacherRecord:
    source_row: int
    name: str
    gender: str | None
    position: str
    disciplines: list[str]
    institution: str
    edu_level: str
    academic_degree: str
    academic_title: str
    qualification: str
    experience: int | None
    experience_text: str
    education_details: list[str]
    professional_development: list[str]
    professional_retraining: list[str]


def _text(element) -> str:
    return re.sub(r"\s+", " ", element.get_text(" ", strip=True)).strip()


def _parts(element) -> list[str]:
    content = element.select_one(".showpart-container-list") or element
    return [value for value in (_text_string(s) for s in content.stripped_strings) if value]


def _text_string(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _items(element) -> list[str]:
    values = []
    for part in _parts(element):
        for item in re.split(r";\s*", part):
            item = item.strip().rstrip(";")
            if item and item not in values:
                values.append(item)
    return values


def _courses(element) -> list[str]:
    text = " ".join(_parts(element))
    if not text or text.casefold().startswith("не проходил"):
        return []
    return [
        re.sub(r"^\d{1,2}\.\s*", "", item).strip()
        for item in re.split(r"(?<!\d)(?=\d{1,2}\.\s+)", text)
        if item.strip()
    ]


def _experience(text: str) -> int | None:
    lower = text.casefold()
    if "менее 1 года" in lower or "нет стажа" in lower:
        return 0
    match = re.search(r"\b(\d+)\s*(?:год|года|лет)\b", lower)
    return int(match.group(1)) if match else None


def parse_teacher_directory(html: bytes | str) -> list[TeacherRecord]:
    soup = BeautifulSoup(html, "html.parser")
    table = next(
        (
            table for table in soup.select("table")
            if "Занимаемая должность" in table.get_text(" ", strip=True)[:1500]
            and "Преподаваемые учебные предметы" in table.get_text(" ", strip=True)[:1500]
        ),
        None,
    )
    if table is None:
        raise ValueError("UTMN teacher table was not found")
    headers = [_text(cell) for cell in table.select_one("tr").find_all(["th", "td"], recursive=False)]
    required = (
        "Фамилия, имя, отчество", "Занимаемая должность", "Преподаваемые учебные предметы",
        "Уровень (уровни) профессионального образования", "Учёная степень", "Учёное звание",
        "Сведения о повышении квалификации", "Сведения о профессиональной переподготовке",
        "Сведения о продолжительности опыта",
    )
    positions = []
    for label in required:
        matches = [index for index, header in enumerate(headers) if label.casefold() in header.casefold()]
        if len(matches) != 1:
            raise ValueError(f"Missing or ambiguous UTMN column: {label}")
        positions.append(matches[0])

    records = []
    seen_rows = set()
    for row in table.select("tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) != len(headers):
            continue
        row_number = _text(cells[0])
        if not row_number.isdecimal():
            continue
        source_row = int(row_number)
        if source_row in seen_rows:
            raise ValueError(f"Duplicate source row: {source_row}")
        seen_rows.add(source_row)
        name, position, disciplines, education, degree, title, development, retraining, experience = (
            cells[index] for index in positions
        )
        education_parts = _parts(education)
        records.append(TeacherRecord(
            source_row=source_row,
            name=_text(name),
            gender=None,
            position=_text(position),
            disciplines=_items(disciplines),
            institution=INSTITUTION,
            edu_level=education_parts[0] if education_parts else "",
            academic_degree=_text(degree),
            academic_title=_text(title),
            qualification=education_parts[-1] if len(education_parts) >= 3 else "",
            experience=_experience(_text(experience)),
            experience_text=_text(experience),
            education_details=education_parts,
            professional_development=_courses(development),
            professional_retraining=_courses(retraining),
        ))
    if not records:
        raise ValueError("UTMN teacher table has no rows")
    return records
