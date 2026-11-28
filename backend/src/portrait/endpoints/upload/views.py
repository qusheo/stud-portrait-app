"""Эндпоинт загрузки Excel-файлов трёх типов: РСВ, оценки, преподаватели."""

from ..helpers.common import POST, ResponseError, csrf_exempt, jsonResponse, method
from .common import check_upload_permission
from .grades import load_grades_records, parse_grades_excel
from .rsv_results import load_rsv_records, parse_rsv_excel
from .teachers import load_teachers_records, parse_teachers_excel

UPLOAD_TYPES = {
    "rsv": (parse_rsv_excel, load_rsv_records),
    "grades": (parse_grades_excel, load_grades_records),
    "teachers": (parse_teachers_excel, load_teachers_records),
}


@method(POST)
@jsonResponse
@csrf_exempt
def import_upload(request):
    """Загружает Excel-файл выбранного типа (multipart: file, type)."""
    check_upload_permission(request)

    excel_file = request.FILES.get("file")
    upload_type = request.POST.get("type")

    if not excel_file:
        raise ResponseError("No file uploaded")
    if upload_type not in UPLOAD_TYPES:
        raise ResponseError(
            f"Unknown upload type: {upload_type}. Expected one of: {', '.join(UPLOAD_TYPES)}"
        )

    parse, load = UPLOAD_TYPES[upload_type]
    parsed = parse(excel_file)
    stats = load(parsed)

    return {"type": upload_type, **stats}
