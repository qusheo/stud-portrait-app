import math

from ..helpers.helpers import (
    FIELDS,
    INDICATORS,
    get_latest_results,
    get_normalized,
    serialize_student,
)

def calculate_category_similarity(
    source: dict,
    candidate: dict,
    fields: list[str],
) -> tuple[float | None, float]:
    differences = []

    for field in fields:
        a = get_normalized(source.get(field))
        b = get_normalized(candidate.get(field))

        if a is not None and b is not None:
            differences.append((a - b) ** 2)

    coverage = len(differences) / len(fields)

    if not differences:
        return None, round(coverage * 100, 2)

    distance = math.sqrt(sum(differences) / len(differences))
    similarity = max(0, min(100, (1 - distance) * 100))

    return round(similarity, 2), round(coverage * 100, 2)

def find_matching_students(
    student_id: int,
    amount: int = 1,
    same_group: bool = False,
    course: int | None = None,
    motivators: bool = True,
    competences: bool = True,
    values: bool = True,
) -> dict:
    if not 1 <= amount <= 100:
        raise ValueError("amount должен быть от 1 до 100")

    selected = {
        "competencies": competences,
        "motivators": motivators,
        "values": values,
    }

    if not any(selected.values()):
        raise ValueError("Выберите хотя бы одну категорию")

    queryset = get_latest_results()

    source = (
        queryset
        .filter(res_participant_id=student_id)
        .values(*FIELDS)
        .first()
    )

    if source is None:
        raise LookupError("Результаты студента не найдены")

    candidates = queryset.exclude(
        res_participant_id=student_id
    )

    if same_group:
        specialty_id = source["res_edu_specialty_id"]

        if specialty_id is None:
            raise ValueError("У студента не указана специальность")

        candidates = candidates.filter(
            res_edu_specialty_id=specialty_id
        )

    if course is not None:
        candidates = candidates.filter(res_course=course)

    matched = []

    for candidate in candidates.values(*FIELDS).iterator(chunk_size=2000):
        similarities = {}
        coverages = {}

        for category, fields in INDICATORS.items():
            score, coverage = calculate_category_similarity(
                source, candidate, fields
            )
            similarities[category] = score
            coverages[category] = coverage

        active = [
            similarities[category]
            for category, enabled in selected.items()
            if enabled and similarities[category] is not None
        ]

        if not active:
            continue

        overall = round(sum(active) / len(active), 2)
        coverage = round(
            sum(
                coverages[category]
                for category, enabled in selected.items()
                if enabled
            ) / sum(selected.values()),
            2,
        )

        matched.append({
            **serialize_student(candidate),
            "similarity": {
                "overall": overall,
                **similarities,
                "coverage": coverage,
            },
        })

    matched.sort(
        key=lambda item: (
            -item["similarity"]["overall"],
            -item["similarity"]["coverage"],
            item["studentId"],
        )
    )

    return {
        "sourceStudentId": student_id,
        "total": len(matched),
        "students": matched[:amount],
    }
