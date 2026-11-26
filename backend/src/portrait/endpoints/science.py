from django.http import JsonResponse
from django.views.decorators.http import require_GET
from portrait.models import Teacher
from portrait.endpoints.scienceService.science import activity


def response(request, teacher_id=None):
    from portrait.endpoints.auth import get_account_type
    from portrait.models import User

    if not request.user.is_authenticated:
        return JsonResponse(
            {"ok": False, "message": "Authentication required"}, status=401
        )
    if get_account_type(request.user) not in (
        User.AccountType.ADMIN,
        User.AccountType.CENTRE,
        User.AccountType.INSTITUTION_ADMIN,
    ):
        return JsonResponse({"ok": False, "message": "Permission denied"}, status=403)
    values = {}
    try:
        for key in ("institution_id", "year", "page"):
            raw = request.GET.get(key)
            values[key] = int(raw) if raw else (1 if key == "page" else None)
            if values[key] is not None and values[key] < 1:
                raise ValueError()
        if values["year"] is not None and not 1500 <= values["year"] <= 2200:
            raise ValueError()
    except (TypeError, ValueError):
        return JsonResponse(
            {"ok": False, "message": "Invalid institution_id, year or page"}, status=400
        )
    if teacher_id is not None and not Teacher.objects.filter(pk=teacher_id).exists():
        return JsonResponse({"ok": False, "message": "Teacher not found"}, status=404)
    data = activity(teacher_id=teacher_id, **values)
    if data is None:
        return JsonResponse(
            {
                "ok": False,
                "message": "Таблицы eLIBRARY ещё не созданы. Выполните init-db и импорт карточек.",
            },
            status=503,
        )
    from portrait.models import Institutions

    data["institutions"] = list(
        Institutions.objects.order_by("inst_name").values("inst_id", "inst_name")
    )
    return JsonResponse({"ok": True, "data": data})


@require_GET
def statistics(request):
    return response(request)
