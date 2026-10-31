
import json

from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_GET, require_POST

from portrait.models import User as PortraitUser


# Разрешения, которые использует фронтенд.
# Пока доступ запрещён по умолчанию.
ACCESS_PERMISSION_KEYS = (
    "canViewStats",
    "canViewGeography",
    "canViewSearch",
    "canViewGrouping",
    "canViewResults",
    "canViewCourses",
    "canViewMotivators",
    "canViewCompetences",
    "canViewStudentPortrait",
    "canViewTeachers",
    "canViewAnalysisDisciplines",
    "canViewAP",
    "canViewAnalysisAdvanced",
    "canViewAiAnalytics",
    "canViewEduProfiles",
    "canViewTransferAnalysis",
    "canViewAnomalousStudents",
    "canViewDuplicateAccounts",
    "canViewHelp",
    "canViewAudit",
    "canViewUpload",
    "canViewSql",
    "canViewOwnPortrait",
    "canViewOwnReport",
)


def get_portrait_account(user):
    """Возвращает профиль StudPortrait или None."""
    if not user.is_authenticated:
        return None

    try:
        return user.portrait_account
    except PortraitUser.DoesNotExist:
        return None


def get_account_type(user):
    """Получает существующую роль из профиля StudPortrait."""
    account = get_portrait_account(user)

    if account is None:
        return None

    if account.account_type not in PortraitUser.AccountType.values:
        return None

    return account.account_type


@require_GET
@ensure_csrf_cookie
def csrf_token(request):
    """Выдаёт CSRF-cookie для запросов, изменяющих данные."""
    return JsonResponse({
        "ok": True,
        "csrfToken": get_token(request),
    })


@require_POST
def login_view(request):
    """Проверяет логин и пароль и создаёт Django-сессию."""
    try:
        data = json.loads(request.body or "{}")
    except (json.JSONDecodeError, UnicodeDecodeError):
        return JsonResponse({
            "ok": False,
            "message": "Некорректный формат запроса",
        }, status=400)

    username = data.get("username")
    password = data.get("password")

    if not isinstance(username, str) or not isinstance(password, str):
        return JsonResponse({
            "ok": False,
            "message": "Укажите логин и пароль",
        }, status=400)

    username = username.strip()

    if not username or not password:
        return JsonResponse({
            "ok": False,
            "message": "Укажите логин и пароль",
        }, status=400)

    user = authenticate(
        request,
        username=username,
        password=password,
    )

    if user is None:
        return JsonResponse({
            "ok": False,
            "message": "Неверный логин или пароль",
        }, status=401)

    # Не разрешаем вход без связанного профиля StudPortrait.
    # Это не позволяет автоматически выдавать роль администратора.
    account_type = get_account_type(user)

    if account_type is None:
        return JsonResponse({
            "ok": False,
            "message": "Для учётной записи не настроена роль StudPortrait",
        }, status=403)

    login(request, user)

    return JsonResponse({
        "ok": True,
        "message": "Вход выполнен",
        "user_id": user.pk,
        "username": user.get_username(),
        "account_type": account_type,
        "is_authenticated": True,
    })


@require_GET
def current_user(request):
    """Возвращает сведения о текущей сессии."""
    if not request.user.is_authenticated:
        return JsonResponse({
            "ok": False,
            "is_authenticated": False,
            "message": "Требуется авторизация",
        }, status=401)

    account_type = get_account_type(request.user)

    if account_type is None:
        return JsonResponse({
            "ok": False,
            "is_authenticated": True,
            "message": "Для учётной записи не настроена роль StudPortrait",
        }, status=403)

    return JsonResponse({
        "ok": True,
        "is_authenticated": True,
        "user_id": request.user.pk,
        "username": request.user.get_username(),
        "email": request.user.email,
        "first_name": request.user.first_name,
        "last_name": request.user.last_name,
        "account_type": account_type,
    })


@require_POST
def logout_view(request):
    """Завершает текущую Django-сессию."""
    if request.user.is_authenticated:
        logout(request)

    return JsonResponse({
        "ok": True,
        "message": "Выход выполнен",
        "is_authenticated": False,
    })


@require_GET
def get_user_permissions(request):
    """Возвращает текущую роль и права пользователя."""
    if not request.user.is_authenticated:
        return JsonResponse({
            "ok": False,
            "is_authenticated": False,
            "message": "Требуется авторизация",
        }, status=401)

    account_type = get_account_type(request.user)

    if account_type is None:
        return JsonResponse({
            "ok": False,
            "is_authenticated": True,
            "message": "Для учётной записи не настроена роль StudPortrait",
        }, status=403)

    permissions = dict.fromkeys(
        ACCESS_PERMISSION_KEYS,
        account_type == PortraitUser.AccountType.ADMIN,
    )
    permissions.update({
        "canViewOwnPortrait": True,
        "canViewOwnReport": True,
    })

    return JsonResponse({
        "ok": True,
        "account_type": account_type,
        "user_id": request.user.pk,
        "username": request.user.get_username(),
        "is_authenticated": True,
        "permissions": permissions,
})
