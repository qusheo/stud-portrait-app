from django.http import JsonResponse
from django.views.decorators.http import require_GET

from ..models import TeacherDirectory


@require_GET
def get_teachers_table(request):
    rows = list(TeacherDirectory.objects.values(
        "id", "source_row", "name", "gender", "position", "disciplines",
        "institution", "edu_level", "academic_degree", "academic_title",
        "qualification", "experience",
    ).order_by("name", "id"))
    for row in rows:
        row["rowId"] = row.pop("id")
    return JsonResponse(
        {"status": "success", "count": len(rows), "data": rows},
        json_dumps_params={"ensure_ascii": False},
    )


@require_GET
def get_teacher_by_id(request, teacher_id):
    try:
        teacher = TeacherDirectory.objects.get(pk=teacher_id)
    except TeacherDirectory.DoesNotExist:
        return JsonResponse(
            {"status": "error", "message": "Преподаватель не найден"},
            status=404,
            json_dumps_params={"ensure_ascii": False},
        )
    data = {
        "rowId": teacher.id,
        "source_row": teacher.source_row,
        "name": teacher.name,
        "gender": teacher.gender,
        "position": teacher.position,
        "disciplines": teacher.disciplines,
        "institution": teacher.institution,
        "edu_level": teacher.edu_level,
        "academic_degree": teacher.academic_degree,
        "academic_title": teacher.academic_title,
        "qualification": teacher.qualification,
        "experience": teacher.experience,
        "experience_text": teacher.experience_text,
        "education_details": teacher.education_details,
        "professional_development": teacher.professional_development,
        "professional_retraining": teacher.professional_retraining,
        "source_url": teacher.source_url,
        "parsed_at": teacher.parsed_at.isoformat(),
    }
    return JsonResponse(
        {"status": "success", "data": data},
        json_dumps_params={"ensure_ascii": False},
    )
