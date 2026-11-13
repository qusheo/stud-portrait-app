import traceback

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from ..common import *

@require_http_methods(["GET"])
def get_teachers_table(request):
    try:
        rows = [
            {
                'id': teacher.id,
                'source_row': teacher.source_row,
                'name': teacher.name,
                'gender': teacher.gender or '',
                'position': teacher.position or '',
                'disciplines': teacher.disciplines or [],
                'institution': teacher.institution or '',
                'edu_level': teacher.edu_level or '',
                'academic_degree': teacher.academic_degree or '',
                'academic_title': teacher.academic_title or '',
                'qualification': teacher.qualification or '',
                'experience': teacher.experience,
                'experience_text': teacher.experience_text or '',
                'education_details': teacher.education_details or [],
                'professional_development': teacher.professional_development or [],
                'professional_retraining': teacher.professional_retraining or [],
            }
            for teacher in Teacher.objects.all().order_by('id')
        ]
        return JsonResponse({"ok": True, "data": rows})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"ok": False, "message": str(e)}, status=500)

@require_http_methods(["GET"])
def get_teacher_by_id(request):
    try:
        teacher_id = int(request.GET.get('teacher_id', ''))
    except ValueError:
        return JsonResponse({'ok': False, 'message': 'teacher_id must be an integer'}, status=400)

    return JsonResponse({
        'ok': True,
        'data': {
            'teacher_id': teacher_id,
            'transfer': [],
            'duplicate_account': [],
            'repeated_year': None,
            'expelled': None,
            'education': [],
            'interests': [],
        }
    })
