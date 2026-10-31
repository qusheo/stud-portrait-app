import json
import traceback
from django.db import connection, transaction
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods

from .common import *

def fetch_student_interests(student_id: int) -> list[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT interest_code
            FROM participant_interests
            WHERE participant_id = %s
            ORDER BY interest_code
            """,
            [student_id],
        )
        return [row[0] for row in cursor.fetchall()]

@require_GET
def get_student_interests(request):
    try:
        student_id = int(request.GET["student_id"])

        if student_id <= 0:
            raise ValueError("Некорректный student_id")

        if not Participants.objects.filter(part_id=student_id).exists():
            return JsonResponse(
                {"ok": False, "message": "Студент не найден"},
                status=404,
            )

        return JsonResponse({
            "ok": True,
            "data": {
                "studentId": student_id,
                "interests": fetch_student_interests(student_id),
            },
        })

    except (ValueError, KeyError):
        return JsonResponse(
            {"ok": False, "message": "Некорректный student_id"},
            status=400,
        )
    except Exception:
        print(traceback.format_exc())
        return JsonResponse(
            {"ok": False, "message": "Ошибка загрузки интересов"},
            status=500,
        )


@require_http_methods(["PATCH"])
def update_student_interests(request):
    try:
        data = json.loads(request.body)

        if not isinstance(data, dict):
            raise ValueError("Ожидается JSON-объект")

        student_id = data.get("student_id")
        changes = data.get("changes")

        if type(student_id) is not int or student_id <= 0:
            raise ValueError("Некорректный student_id")

        if not isinstance(changes, dict):
            raise ValueError("changes должен быть объектом")

        if any(type(value) is not bool for value in changes.values()):
            raise ValueError("Значения changes должны быть boolean")

        if not can_access_student_interests(request, student_id):
            return JsonResponse(
                {"ok": False, "message": "Доступ запрещён"},
                status=403,
            )

        if not Participants.objects.filter(part_id=student_id).exists():
            return JsonResponse(
                {"ok": False, "message": "Студент не найден"},
                status=404,
            )

        codes = list(changes)

        with transaction.atomic():
            with connection.cursor() as cursor:
                if codes:
                    cursor.execute(
                        "SELECT code FROM interests WHERE code = ANY(%s)",
                        [codes],
                    )
                    valid_codes = {row[0] for row in cursor.fetchall()}
                    unknown = set(codes) - valid_codes

                    if unknown:
                        raise ValueError(
                            f"Неизвестные интересы: {', '.join(sorted(unknown))}"
                        )

                for code, selected in changes.items():
                    if selected:
                        cursor.execute(
                            """
                            INSERT INTO participant_interests
                                (participant_id, interest_code)
                            VALUES (%s, %s)
                            ON CONFLICT (participant_id, interest_code)
                            DO NOTHING
                            """,
                            [student_id, code],
                        )
                    else:
                        cursor.execute(
                            """
                            DELETE FROM participant_interests
                            WHERE participant_id = %s
                              AND interest_code = %s
                            """,
                            [student_id, code],
                        )

            interests = fetch_student_interests(student_id)

        return JsonResponse({
            "ok": True,
            "data": {
                "studentId": student_id,
                "interests": interests,
            },
        })

    except (ValueError, TypeError, json.JSONDecodeError) as e:
        return JsonResponse(
            {"ok": False, "message": str(e)},
            status=400,
        )
    except Exception:
        print(traceback.format_exc())
        return JsonResponse(
            {"ok": False, "message": "Ошибка сохранения интересов"},
            status=500,
        )
