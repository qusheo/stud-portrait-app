import traceback

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods

from ..common import *

def get_teachers_table():
    fields = [
        'name',
        'gender',
        'position',
        'disciplines',
        'institution',
        'edu_level',
        'academic_degree',
        'academic_title',
        'qualification',
        'experience',
    ]
    try:
        rows = []
        for i in fields:
            rows.append({i: 0}) #прросто заготовка пока
        return JsonResponse({"ok": True, "data": rows})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"ok": False, "message": str(e)}, status=500)

@require_http_methods(["GET"])
def get_teacher_by_id(request):
    try:
        teacher_id = int(request.GET.get('teacher_id', ''))
    except ValueError:
        return JsonResponse({'status': 'error', 'message': 'teacher_id must be an integer'}, status=400)

    return JsonResponse({
        'status': 'success',
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
