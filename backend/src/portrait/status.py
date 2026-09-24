from django.http import JsonResponse


def health(request):
    return JsonResponse({
        "status": "ok"
    })


def maintenance(request, exception=None):
    return JsonResponse(
        {
            "error": "service_unavailable",
            "message": "Сервис временно недоступен"
        },
        status=503
    )