
import math
from typing import Any

from django.db.models import OuterRef, Subquery

from ...constants import (
    RsvCompetencies as COMP,
    RsvMotivators as MOT,
    RsvValues as VAL,
    TableTestResults as tRES,
)
from ...models import Results


INDICATORS = {
    "competencies": COMP.list,
    "motivators": MOT.list,
    "values": VAL.list,
}

LEVELS = {
    "medium": 400,
    "high": 600,
}

FIELDS = [
    tRES.ID,
    f"{tRES.PARTICIPANT}_id",
    f"{tRES.EDU_SPEC}_id",
    tRES.COURSE_NUM,
    tRES.YEAR,
    *(field for group in INDICATORS.values() for field in group),
]

def get_latest_results():
    """Один последний результат оценивания на участника"""
    latest = (
        Results.objects
        .filter(res_participant_id=OuterRef("res_participant_id"))
        .order_by("-res_id")
        .values("res_id")[:1]
    )

    return Results.objects.filter(
        res_id=Subquery(latest)
    )

def get_normalized(value: Any) -> float | None:
    if value is None:
        return None

    value = float(value)

    if not math.isfinite(value) or not 200 <= value <= 800:
        return None

    return (value - 200) / 600

def serialize_student(row: dict) -> dict:
    return {
        "studentId": row["res_participant_id"],
        "resultId": row[tRES.ID],
        "specialtyId": row["res_edu_specialty_id"],
        "course": row[tRES.COURSE_NUM],
        "year": row[tRES.YEAR],
    }