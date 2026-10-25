
import json
import traceback

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from ..helpers.helpers import (
    FIELDS,
    INDICATORS,
    LEVELS,
    get_latest_results,
    serialize_student,
)


def parse_requirements(
    requirements: dict[str, dict[str, str]],
) -> dict[str, int]:
    filters = {}

    for category, indicators in requirements.items():
        if category not in INDICATORS:
            raise ValueError(f"Неизвестная категория: {category}")

        if not isinstance(indicators, dict):
            raise ValueError(f"Некорректные требования: {category}")

        allowed_fields = INDICATORS[category]

        if not indicators:
            filters.update({
                field: LEVELS["medium"]
                for field in allowed_fields
            })
            continue

        for field, level in indicators.items():
            if field not in allowed_fields:
                raise ValueError(f"Неизвестный показатель: {field}")

            if not isinstance(level, str) or level not in LEVELS:
                raise ValueError(f"Некорректный уровень: {level}")

            filters[field] = LEVELS[level]

    return filters


def calculate_requirements_score(
    row: dict,
    filters: dict[str, int],
) -> float | None:
    if not filters:
        return None

    scores = [
        (float(row[field]) - minimum) / (800 - minimum)
        for field, minimum in filters.items()
    ]

    return round(100 * sum(scores) / len(scores), 2)


def find_students_by_requirements(
    requirements: dict[str, dict[str, str]] | None = None,
    specialty_ids: list[int] | None = None,
    courses: list[int] | None = None,
    limit: int = 30,
    offset: int = 0,
) -> dict:
    if not 1 <= limit <= 100:
        raise ValueError("limit должен быть от 1 до 100")

    if offset < 0:
        raise ValueError("offset не может быть отрицательным")

    filters = parse_requirements(requirements or {})
    queryset = get_latest_results()

    if specialty_ids:
        queryset = queryset.filter(
            res_edu_specialty_id__in=specialty_ids
        )

    if courses:
        queryset = queryset.filter(
            res_course__in=courses
        )

    for field, minimum in filters.items():
        queryset = queryset.filter(**{
            f"{field}__gte": minimum,
            f"{field}__lte": 800,
        })

    # Если требований нет, возможна пагинация непосредственно в SQL.
    if not filters:
        queryset = queryset.order_by("res_participant_id")
        total = queryset.count()

        rows = queryset.values(*FIELDS)[offset:offset + limit]

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "students": [
                {**serialize_student(row), "matchScore": None}
                for row in rows
            ],
        }

    students = []

    for row in queryset.values(*FIELDS).iterator(chunk_size=2000):
        students.append({
            **serialize_student(row),
            "matchScore": calculate_requirements_score(row, filters),
        })

    students.sort(
        key=lambda item: (-item["matchScore"], item["studentId"])
    )

    return {
        "total": len(students),
        "limit": limit,
        "offset": offset,
        "students": students[offset:offset + limit],
    }

@csrf_exempt
@require_POST
def get_students_by_requirememnts(request):
    """Подбор студентов по требованиям."""
    try:
        data = json.loads(request.body)

        if not isinstance(data, dict):
            raise ValueError("Ожидается JSON-объект")

        requirements = data.get("requirements", {})
        specialty_ids = data.get("specialtyIds", [])
        courses = data.get("courses", [])

        if not isinstance(requirements, dict):
            raise ValueError("requirements должен быть объектом")

        if not isinstance(specialty_ids, list):
            raise ValueError("specialtyIds должен быть массивом")

        if not isinstance(courses, list):
            raise ValueError("courses должен быть массивом")

        specialty_ids = [ value for value in specialty_ids ]

        courses = [ value for value in courses ]

        limit = data.get("limit", 30)
        offset = data.get("offset", 0)

        result = find_students_by_requirements(
            requirements=requirements,
            specialty_ids=specialty_ids,
            courses=courses,
            limit=limit,
            offset=offset,
        )

        return JsonResponse({"ok": True, "data": result})

    except (ValueError, TypeError, json.JSONDecodeError) as e:
        return JsonResponse(
            {"ok": False, "message": str(e)},
            status=400,
        )

    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse(
            {"ok": False, "message": "Ошибка поиска студентов"},
            status=500,
        )
