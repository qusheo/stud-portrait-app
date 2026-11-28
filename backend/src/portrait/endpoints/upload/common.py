"""Общие утилиты загрузки Excel: разбор заголовков и доступ."""

import re

import openpyxl

from ..auth import get_account_type
from ..dataload import clean_value, convert_grade_to_int, parse_gender
from ..helpers.common import ResponseError
from ...models import User as PortraitUser

UPLOAD_PERMISSION_ROLES = (
    PortraitUser.AccountType.ADMIN,
    PortraitUser.AccountType.CENTRE,
    PortraitUser.AccountType.INSTITUTION_ADMIN,
)


def check_upload_permission(request):
    """Проверяет, что пользователь авторизован и имеет право canUploadData."""
    if not request.user.is_authenticated:
        raise ResponseError("Authentication required", status=401)

    account_type = get_account_type(request.user)
    if account_type not in UPLOAD_PERMISSION_ROLES:
        raise ResponseError("No permission to upload data", status=403)


def normalize_header(value) -> str:
    """Приводит заголовок колонки к каноническому виду для сопоставления."""
    if value is None:
        return ""
    text = str(value).strip().lower().replace("ё", "е")
    return re.sub(r"[\s\-]+", "_", text)


def _header_matches(header: str, expected: str) -> bool:
    return header == expected or header.startswith(expected) or expected.startswith(header)


def find_columns(worksheet, expected_names, scan_rows=10):
    """Находит строку заголовков и сопоставляет ожидаемые поля с колонками.

    Возвращает (номер строки с данными, {поле: индекс колонки}).
    Отсутствующие в файле колонки отображаются в None.
    """
    expected = {name: normalize_header(name) for name in expected_names}

    for header_row in worksheet.iter_rows(min_row=1, max_row=scan_rows):
        headers = [normalize_header(cell.value) for cell in header_row]
        matches = sum(
            1
            for norm in expected.values()
            if any(_header_matches(header, norm) for header in headers if header)
        )
        if matches < 2:
            continue

        columns = {}
        for name, norm in expected.items():
            index = next(
                (idx for idx, header in enumerate(headers) if header and _header_matches(header, norm)),
                None,
            )
            columns[name] = index
        return header_row[0].row + 1, columns

    raise ResponseError("Не удалось найти строку заголовков в файле", status=400)


def iter_sheet_rows(worksheet, start_row, columns, key_field, empty_rows_limit=5):
    """Итерирует строки листа как dict поле → значение до серии пустых строк."""
    empty_streak = 0
    for row in worksheet.iter_rows(min_row=start_row):
        record = {
            field: (row[index].value if index is not None and index < len(row) else None)
            for field, index in columns.items()
        }
        if key_field and clean_value(record.get(key_field)) is None:
            empty_streak += 1
            if empty_streak >= empty_rows_limit:
                break
            continue
        empty_streak = 0
        yield record


def open_workbook(excel_file):
    try:
        return openpyxl.load_workbook(excel_file, data_only=True)
    except Exception as exc:
        raise ResponseError(f"Не удалось прочитать Excel файл: {exc}", status=400)
