import argparse
import os
import re
import sys

import pandas as pd
import psycopg
from dotenv import load_dotenv

load_dotenv()


def clean_students_count(raw):
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return None
    cleaned = re.sub(r"[\s ]+", "", str(raw))
    if not cleaned or not cleaned.isdigit():
        return None
    return int(cleaned)


def normalize_name(name):
    return " ".join(str(name).split())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", help="Путь к CSV от parser.py")
    parser.add_argument("--dry-run", action="store_true", help="Не писать в БД, только посчитать")
    args = parser.parse_args()

    df = pd.read_csv(args.csv_path, encoding="utf-8-sig")

    conn_params = {
        "dbname": os.getenv("DB_NAME"),
        "user": os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
        "host": os.getenv("DB_HOST"),
        "port": os.getenv("DB_PORT"),
    }

    if not args.dry_run and not all(conn_params.values()):
        print("Не найдены переменные окружения для подключения к БД "
              "(DB_NAME/DB_USER/DB_PASSWORD/DB_HOST/DB_PORT). "
              "Убедись, что запускаешь скрипт из backend/src/ и .env на месте.")
        sys.exit(1)

    institutions_created = 0
    amounts_created = 0
    amounts_updated = 0
    skipped_no_data = 0

    conn = None if args.dry_run else psycopg.connect(**conn_params)

    try:
        for _, row in df.iterrows():
            students = clean_students_count(row.get("students"))
            if students is None:
                skipped_no_data += 1
                continue

            name = normalize_name(row["university"])
            year = int(row["year"])

            if args.dry_run:
                continue

            with conn.cursor() as cur:
                cur.execute("SELECT inst_id FROM institutions WHERE inst_name = %s", (name,))
                found = cur.fetchone()

                if found:
                    inst_id = found[0]
                else:
                    cur.execute(
                        "INSERT INTO institutions (inst_name) VALUES (%s) RETURNING inst_id",
                        (name,),
                    )
                    inst_id = cur.fetchone()[0]
                    institutions_created += 1

                cur.execute(
                    "SELECT id FROM students_amounts WHERE inst_id = %s AND year = %s",
                    (inst_id, year),
                )
                existing = cur.fetchone()

                if existing:
                    cur.execute(
                        "UPDATE students_amounts SET amount_of_students = %s WHERE id = %s",
                        (students, existing[0]),
                    )
                    amounts_updated += 1
                else:
                    cur.execute(
                        "INSERT INTO students_amounts (inst_id, year, amount_of_students) "
                        "VALUES (%s, %s, %s)",
                        (inst_id, year, students),
                    )
                    amounts_created += 1

        if conn is not None:
            conn.commit()

    finally:
        if conn is not None:
            conn.close()

    print(f"Строк в CSV: {len(df)}")
    print(f"Пропущено (нет данных о численности): {skipped_no_data}")
    if args.dry_run:
        print("Dry-run — в БД ничего не записывалось")
    else:
        print(f"Новых вузов создано: {institutions_created}")
        print(f"Новых записей students_amounts: {amounts_created}")
        print(f"Обновлено записей students_amounts: {amounts_updated}")


if __name__ == "__main__":
    main()
