"""Import the saved official UTMN staff page into PostgreSQL.

Usage: python backend/tools/import_teacher_directory.py path/to/saved-page.html
"""

import argparse
import sys
from pathlib import Path

import psycopg
from dotenv import dotenv_values
from psycopg.types.json import Jsonb


BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "src"))

from portrait.teacher_directory_parser import SOURCE_URL, parse_teacher_directory  # noqa: E402


UPSERT = """
    INSERT INTO teacher_directory (
        source_row, name, gender, position, disciplines, institution, edu_level,
        academic_degree, academic_title, qualification, experience, experience_text,
        education_details, professional_development, professional_retraining, source_url
    ) VALUES (
        %(source_row)s, %(name)s, %(gender)s, %(position)s, %(disciplines)s,
        %(institution)s, %(edu_level)s, %(academic_degree)s, %(academic_title)s,
        %(qualification)s, %(experience)s, %(experience_text)s, %(education_details)s,
        %(professional_development)s, %(professional_retraining)s, %(source_url)s
    ) ON CONFLICT (source_row) DO UPDATE SET
        name = EXCLUDED.name,
        gender = EXCLUDED.gender,
        position = EXCLUDED.position,
        disciplines = EXCLUDED.disciplines,
        institution = EXCLUDED.institution,
        edu_level = EXCLUDED.edu_level,
        academic_degree = EXCLUDED.academic_degree,
        academic_title = EXCLUDED.academic_title,
        qualification = EXCLUDED.qualification,
        experience = EXCLUDED.experience,
        experience_text = EXCLUDED.experience_text,
        education_details = EXCLUDED.education_details,
        professional_development = EXCLUDED.professional_development,
        professional_retraining = EXCLUDED.professional_retraining,
        source_url = EXCLUDED.source_url,
        parsed_at = now()
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("html", type=Path, help="Saved UTMN teacher directory HTML")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--min-rows", type=int, default=1000)
    args = parser.parse_args()

    records = parse_teacher_directory(args.html.read_bytes())
    print(f"Parsed {len(records)} teacher rows ({len({r.name for r in records})} distinct names)")
    if len(records) < args.min_rows:
        parser.error(f"Expected at least {args.min_rows} rows; refusing a partial import")
    if args.dry_run:
        return

    config = dotenv_values(BACKEND / "src" / ".env")
    required = ("DB_NAME", "DB_USER", "DB_HOST", "DB_PORT")
    if any(not config.get(key) for key in required):
        parser.error("Set DB_NAME, DB_USER, DB_HOST and DB_PORT in backend/src/.env")
    connection_args = {
        "dbname": config["DB_NAME"],
        "user": config["DB_USER"],
        "password": config.get("DB_PASSWORD") or "",
        "host": config["DB_HOST"],
        "port": config["DB_PORT"],
        "connect_timeout": 10,
    }
    rows = []
    for record in records:
        values = record.__dict__.copy()
        for key in (
            "disciplines", "education_details", "professional_development",
            "professional_retraining",
        ):
            values[key] = Jsonb(values[key])
        values["source_url"] = SOURCE_URL
        rows.append(values)

    with psycopg.connect(**connection_args) as connection:
        with connection.cursor() as cursor:
            cursor.execute((BACKEND / "create_teacher_directory.sql").read_text(encoding="utf-8"))
            cursor.executemany(UPSERT, rows)
            count = cursor.execute("SELECT count(*) FROM teacher_directory").fetchone()[0]
    print(f"Imported into teacher_directory: {count} rows")


if __name__ == "__main__":
    main()
