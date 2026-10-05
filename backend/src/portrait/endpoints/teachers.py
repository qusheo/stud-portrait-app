import json
import threading
import traceback

from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from ..models import TeacherParseLog, Teachers
from ..teacher_parser import DEFAULT_TEACHER_SOURCE_URLS, parse_teachers


def _serialize_teacher(teacher: Teachers) -> dict:
    return {
        "id": teacher.teacher_id,
        "full_name": teacher.full_name,
        "position": teacher.position,
        "degree": teacher.degree,
        "department": teacher.department,
        "email": teacher.email,
        "profile_url": teacher.profile_url,
        "source_url": teacher.source_url,
        "interests": teacher.interests or [],
        "qualification_courses": teacher.qualification_courses or [],
        "publications": teacher.publications or [],
        "projects": teacher.projects or [],
        "modeus_disciplines": teacher.modeus_disciplines or [],
        "raw_profile": teacher.raw_profile or {},
        "parsed_at": teacher.parsed_at.isoformat() if teacher.parsed_at else None,
    }


def _run_teacher_parser(log_id: int, source_urls: list[str], include_lms: bool) -> None:
    log = TeacherParseLog.objects.get(pk=log_id)
    try:
        last_progress = {"cur": 0, "total": 0}

        def _progress(_step, cur=0, total=0):
            last_progress["cur"] = cur
            last_progress["total"] = total
            TeacherParseLog.objects.filter(pk=log_id).update(
                teachers_found=max(total, last_progress["total"]),
                teachers_saved=last_progress["cur"],
            )

        profiles = parse_teachers(
            source_urls=source_urls,
            include_lms=include_lms,
            progress_callback=_progress,
        )

        saved = 0
        for profile in profiles:
            Teachers.objects.update_or_create(
                full_name=profile.full_name,
                defaults={
                    "position": profile.position or None,
                    "degree": profile.degree or None,
                    "department": profile.department or None,
                    "email": profile.email or None,
                    "profile_url": profile.profile_url or None,
                    "source_url": profile.source_url or None,
                    "interests": profile.interests,
                    "qualification_courses": profile.qualification_courses,
                    "publications": profile.publications,
                    "projects": profile.projects,
                    "modeus_disciplines": profile.modeus_disciplines,
                    "raw_profile": profile.raw_profile,
                },
            )
            saved += 1

        log.status = TeacherParseLog.STATUS_SUCCESS
        log.teachers_found = len(profiles)
        log.teachers_saved = saved
        log.finished_at = timezone.now()
        log.save()
    except Exception as exc:
        log.status = TeacherParseLog.STATUS_ERROR
        log.error_message = f"{exc}\n\n{traceback.format_exc()}"
        log.finished_at = timezone.now()
        log.save()


@require_http_methods(["GET"])
def list_teachers(request):
    search = request.GET.get("search", "").strip()
    try:
        limit = min(int(request.GET.get("limit", 100)), 500)
    except (TypeError, ValueError):
        limit = 100

    teachers = Teachers.objects.all()
    if search:
        teachers = teachers.filter(full_name__icontains=search)

    items = [_serialize_teacher(teacher) for teacher in teachers[:limit]]
    return JsonResponse({
        "status": "success",
        "count": len(items),
        "teachers": items,
    }, json_dumps_params={"ensure_ascii": False})


@require_http_methods(["GET"])
def teacher_detail(request, teacher_id: int):
    try:
        teacher = Teachers.objects.get(pk=teacher_id)
    except Teachers.DoesNotExist:
        return JsonResponse({
            "status": "error",
            "message": "Преподаватель не найден",
        }, status=404, json_dumps_params={"ensure_ascii": False})

    return JsonResponse({
        "status": "success",
        "teacher": _serialize_teacher(teacher),
    }, json_dumps_params={"ensure_ascii": False})


@csrf_exempt
@require_http_methods(["POST"])
def parse_teachers_view(request):
    try:
        body = json.loads(request.body or b"{}")
    except ValueError:
        body = {}

    source_urls = body.get("source_urls") or DEFAULT_TEACHER_SOURCE_URLS
    include_lms = bool(body.get("include_lms", True))

    if TeacherParseLog.objects.filter(status=TeacherParseLog.STATUS_RUNNING).exists():
        running = TeacherParseLog.objects.filter(status=TeacherParseLog.STATUS_RUNNING).first()
        return JsonResponse({
            "status": "already_running",
            "message": "Парсер преподавателей уже запущен. Дождитесь завершения.",
            "log_id": running.pk,
        }, json_dumps_params={"ensure_ascii": False})

    log = TeacherParseLog.objects.create(
        status=TeacherParseLog.STATUS_RUNNING,
        source_urls=source_urls,
    )
    thread = threading.Thread(
        target=_run_teacher_parser,
        args=(log.pk, source_urls, include_lms),
        daemon=True,
    )
    thread.start()

    return JsonResponse({
        "status": "started",
        "message": "Парсер преподавателей запущен в фоновом режиме",
        "log_id": log.pk,
        "source_urls": source_urls,
    }, json_dumps_params={"ensure_ascii": False})


@require_http_methods(["GET"])
def parse_teachers_log(request):
    logs = TeacherParseLog.objects.all()[:10]
    return JsonResponse({
        "status": "success",
        "logs": [
            {
                "id": log.pk,
                "status": log.status,
                "started_at": log.started_at.isoformat() if log.started_at else None,
                "finished_at": log.finished_at.isoformat() if log.finished_at else None,
                "source_urls": log.source_urls or [],
                "teachers_found": log.teachers_found,
                "teachers_saved": log.teachers_saved,
                "error_message": log.error_message,
            }
            for log in logs
        ],
    }, json_dumps_params={"ensure_ascii": False})
