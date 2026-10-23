# эндпоинт матчинга
import traceback

from django.http import JsonResponse
from django.views.decorators.http import require_GET

from .matching_utils import find_matching_students

@require_GET
def get_matching_students(request):
    """Подбор студентов, похожих на исходного студента."""
    try:
        params = request.GET

        def get_bool(name, default):
            value = params.get(name)
            if value is None:
                return default
            if value.lower() not in ("true", "false"):
                raise ValueError(f"{name} должен быть true или false")
            return value.lower() == "true"

        result = find_matching_students(
            student_id=int(params.get("student_id")),
            amount=int(params.get("amount", 1)),
            same_group=get_bool("sameGroup", False),
            course=int(params["course"]) if params.get("course") is not None else None,
            motivators=get_bool("motivators", True),
            competences=get_bool("competences", True),
            values=get_bool("values", True),
        )

        return JsonResponse({"ok": True, "data": result})

    except LookupError as e:
        return JsonResponse(
            {"ok": False, "message": str(e)},
            status=404,
        )

    except (ValueError, TypeError) as e:
        return JsonResponse(
            {"ok": False, "message": str(e)},
            status=400,
        )

    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse(
            {"ok": False, "message": "Ошибка подбора студентов"},
            status=500,
        )

def get_matching_teachers_by_student(request):
    ''' преподаватели по студенту '''
    try:
        # { teacher: teacher, percent: percent }
        return JsonResponse({"ok": True, "data": {}})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"ok": False, "message": str(e)}, status=500)

def get_match_groups(request):
    ''' учебные команды '''
    try:
        return JsonResponse({"ok": True, "data": {}})
    except Exception as e:
        print(traceback.format_exc())
        return JsonResponse({"ok": False, "message": str(e)}, status=500)