"""Import the saved official UTMN staff page into the teachers table.

Usage: python backend/tools/import_teacher.py path/to/saved-page.html
"""

import argparse
import os
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "studportrait.settings")

import django  # noqa: E402

django.setup()

from portrait.models import Teacher  # noqa: E402
from ..teacher_parser import parse_teacher  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path, help="Saved UTMN teacher directory HTML")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--min-rows", type=int, default=1000)
    args = parser.parse_args()

    records = parse_teacher(args.html.read_bytes())
    print(f"Parsed {len(records)} teacher rows ({len({r.name for r in records})} distinct names)")
    if len(records) < args.min_rows:
        parser.error(f"Expected at least {args.min_rows} rows; refusing a partial import")
    if args.dry_run:
        return

    teachers = [
        Teacher(
            source_row=record.source_row,
            name=record.name,
            gender=record.gender,
            position=record.position,
            disciplines=record.disciplines,
            institution=record.institution,
            edu_level=record.edu_level,
            academic_degree=record.academic_degree,
            academic_title=record.academic_title,
            qualification=record.qualification,
            experience=record.experience,
            experience_text=record.experience_text,
            education_details=record.education_details,
            professional_development=record.professional_development,
            professional_retraining=record.professional_retraining,
        )
        for record in records
    ]

    # Full refresh: the source page is the complete directory.
    Teacher.objects.all().delete()
    Teacher.objects.bulk_create(teachers)
    print(f"Imported into teacher: {Teacher.objects.count()} rows")


if __name__ == "__main__":
    main()
