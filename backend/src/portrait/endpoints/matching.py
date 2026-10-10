# эндпоинт матчинга 
from django.http import JsonResponse
from collections import defaultdict
import traceback
from django.db.models import Avg, Count, Q, F
from django.http import JsonResponse
from .common import *


def get_matching_students(student_id, amount = 1):
    ''' студенты по студенту (команда)'''
    try:
        # { student: student, percent: percent }
        return JsonResponse({"status": "success", "data": {}})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

def get_matching_teachers_by_student(student_id):
    ''' преподаватели по студенту '''
    try:
        # { teacher: teacher, percent: percent }
        return JsonResponse({"status": "success", "data": {}})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"status": "error", "message": str(e)}, status=500)

def get_match_groups(specialty, university, course):
    ''' учебные команды '''
    try:
        return JsonResponse({"status": "success", "data": {}})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"status": "error", "message": str(e)}, status=500)