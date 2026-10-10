from django.http import JsonResponse
from collections import defaultdict
import traceback
from django.db.models import Avg, Count, Q, F
from django.http import JsonResponse
from .common import *

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
        return JsonResponse({"status": "success", "data": rows})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

def get_teacher_by_id():
    try:
        
        return JsonResponse({"status": "success", "data": {}})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"status": "error", "message": str(e)}, status=500)