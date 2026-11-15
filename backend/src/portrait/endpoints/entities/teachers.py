from django.http import JsonResponse
from django.views.decorators.http import require_GET

from portrait.models import Teacher


def serialize_teacher(teacher):
    educations = [
        {
            'education_type': item.education_type,
            'direction': item.direction,
            'qualification': item.qualification,
        }
        for item in teacher.educations.all()
    ]
    first = educations[0] if educations else {}
    return {
        'id': teacher.id,
        'source_row': teacher.source_row,
        'name': teacher.name,
        'gender': teacher.gender,
        'position': teacher.position or '',
        'disciplines': [item.name for item in teacher.discipline_rows.all()],
        'institution': teacher.institution.inst_name,
        'institution_id': teacher.institution_id,
        'edu_level': first.get('education_type', ''),
        'academic_degree': teacher.academic_degree,
        'academic_title': teacher.academic_title,
        'qualification': first.get('qualification', ''),
        'experience': teacher.experience,
        'education': educations,
        'education_details': [first['education_type'], first['direction'], first['qualification']] if first else [],
        'professional_development': teacher.professional_development or [],
        'professional_retraining': teacher.professional_retraining or [],
    }


@require_GET
def get_teachers_table(request):
    teachers = Teacher.objects.select_related('institution').prefetch_related('educations', 'discipline_rows').order_by('id')
    return JsonResponse({'ok': True, 'data': [serialize_teacher(teacher) for teacher in teachers]})


@require_GET
def get_teacher_by_id(request):
    try:
        teacher_id = int(request.GET.get('teacher_id', ''))
    except ValueError:
        return JsonResponse({'ok': False, 'message': 'teacher_id must be an integer'}, status=400)
    teacher = Teacher.objects.select_related('institution').prefetch_related('educations', 'discipline_rows').filter(pk=teacher_id).first()
    if teacher is None:
        return JsonResponse({'ok': False, 'message': 'Teacher not found'}, status=404)
    data = serialize_teacher(teacher)
    data.update(teacher_id=teacher.id, transfer=[], duplicate_account=[], repeated_year=None, expelled=None, interests=[])
    return JsonResponse({'ok': True, 'data': data})
