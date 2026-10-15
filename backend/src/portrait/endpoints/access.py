from django.http import JsonResponse

from portrait.models import User


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


def get_user_permissions(request):
    if request.method != "GET":
        return JsonResponse({"status": "error", "message": "Method not allowed"}, status=405)

    account = None
    if request.user.is_authenticated:
        try:
            account = request.user.portrait_account
        except User.DoesNotExist:
            pass

    if account is None:
        account_type = User.AccountType.ADMIN
    else:
        account_type = account.account_type
        if account_type not in User.AccountType.values:
            account_type = User.AccountType.ADMIN

    permissions = dict.fromkeys(ACCESS_PERMISSION_KEYS, True)

    return JsonResponse({
        "status": "success",
        "account_type": account_type,
        "user_id": request.user.pk if request.user.is_authenticated else None,
        "is_authenticated": request.user.is_authenticated,
        "permissions": permissions,
    })