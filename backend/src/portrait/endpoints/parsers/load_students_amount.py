import argparse
import csv
import os
import re
import sys
from collections import Counter, defaultdict

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


def read_preview_mapping(path):
    with open(path, encoding="utf-8-sig", newline="") as report:
        return {
            row["source_id"]: (int(row["inst_ids"]), row["database_names"])
            for row in csv.DictReader(report, delimiter=";")
            if row["status"] == "candidate"
        }


def preview(df, conn_params, mapping, *, apply=False, allow_unmatched=False):
    institutions = {}
    amounts = defaultdict(list)

    with psycopg.connect(**conn_params) as conn, conn.cursor() as cur:
        if apply:
            cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        else:
            cur.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
        cur.execute("SELECT inst_id, inst_name FROM institutions")
        for inst_id, name in cur:
            institutions[inst_id] = name

        cur.execute("SELECT inst_id, year, amount_of_students FROM students_amounts")
        for inst_id, year, amount in cur:
            amounts[inst_id, year].append(amount)

        candidates = defaultdict(set)
        labels = {}
        skipped = 0
        for _, row in df.iterrows():
            students = clean_students_count(row.get("students"))
            if students is None:
                skipped += 1
                continue
            if pd.isna(row["university"]) or not normalize_name(row["university"]):
                raise ValueError("Empty university name in CSV")
            name = normalize_name(row["university"])
            source_id = str(row.get("id", "")).strip()
            target = mapping.get(source_id)
            ids = []
            if target is not None:
                inst_id, expected_name = target
                if institutions.get(inst_id) != expected_name:
                    raise ValueError(f"Institution {inst_id} differs from the review report")
                ids = [inst_id]
            year = int(row["year"])
            key = (ids[0] if len(ids) == 1 else name, year)
            candidates[key].add(students)
            labels[key] = (name, ids)

        counts = Counter()
        pending = []
        for key, values in candidates.items():
            _, year = key
            name, ids = labels[key]
            if len(values) > 1:
                status, detail = "csv_conflict", str(sorted(values))
            elif not ids:
                status, detail = "unmatched", ""
            elif len(ids) > 1:
                status, detail = "ambiguous", f"inst_id={sorted(ids)}"
            else:
                students = next(iter(values))
                existing = amounts.get((ids[0], year), [])
                if len(existing) > 1:
                    status, detail = "db_duplicate", f"inst_id={ids[0]}, existing={existing}"
                elif not existing:
                    status, detail = "insert", ""
                    pending.append((ids[0], year, students))
                elif existing[0] == students:
                    status, detail = "unchanged", ""
                else:
                    status, detail = "update", f"{existing[0]} -> {students}"
            counts[status] += 1
            if status not in {"insert", "unchanged"}:
                print(f"{status}: {year} | {name} | {detail}")

        if apply:
            blockers = ("update", "ambiguous", "csv_conflict", "db_duplicate")
            if any(counts[status] for status in blockers):
                raise SystemExit("Import stopped: resolve conflicts or changed values first.")
            if counts["unmatched"] and not allow_unmatched:
                raise SystemExit("Import stopped: unmatched rows remain.")
            if pending:
                cur.executemany(
                    "INSERT INTO students_amounts (inst_id, year, amount_of_students) "
                    "VALUES (%s, %s, %s) ON CONFLICT (inst_id, year) DO NOTHING",
                    pending,
                )
                if cur.rowcount != len(pending):
                    raise SystemExit("Import rolled back: existing rows changed during import.")

    print(f"CSV rows: {len(df)}, skipped: {skipped}")
    for status in ("insert", "unchanged", "update", "unmatched", "ambiguous",
                   "csv_conflict", "db_duplicate"):
        print(f"{status}: {counts[status]}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", help="Путь к CSV от parser.py")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--apply-mapped", action="store_true", help="Insert missing mapped records")
    mode.add_argument("--preview", action="store_true", help="Read-only database preview")
    mode.add_argument("--dry-run", action="store_true", help="Не писать в БД, только посчитать")
    parser.add_argument("--mapping", help="Path to the matching review CSV")
    parser.add_argument("--allow-unmatched", action="store_true", help="Skip unmapped rows during import")
    args = parser.parse_args()
    use_mapping = args.preview or args.apply_mapped
    if use_mapping != bool(args.mapping):
        parser.error("--mapping is required with --preview or --apply-mapped")
    if args.allow_unmatched and not args.apply_mapped:
        parser.error("--allow-unmatched requires --apply-mapped")

    df = pd.read_csv(args.csv_path, encoding="utf-8-sig", dtype={"id": str} if use_mapping else None)

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

    if use_mapping:
        preview(
            df,
            {**conn_params, "sslmode": os.getenv("DB_SSLMODE", "disable")},
            read_preview_mapping(args.mapping),
            apply=args.apply_mapped,
            allow_unmatched=args.allow_unmatched,
        )
        return

    rows = {}
    skipped = 0
    for _, row in df.iterrows():
        students = clean_students_count(row.get("students"))
        if students is None:
            skipped += 1
            continue
        name = normalize_name(row["university"])
        if pd.isna(row["university"]) or not name:
            raise ValueError("Empty university name in CSV")
        rows[name, int(row["year"])] = students

    print(f"Строк в CSV: {len(df)}, пропущено: {skipped}", flush=True)
    if args.dry_run:
        print("Проверка завершена. Подключения к БД и записи не было.")
        return

    sslmode = os.getenv("DB_SSLMODE")
    if sslmode:
        conn_params["sslmode"] = sslmode
    created, inserted, updated = import_batch(rows, conn_params)
    print(f"Новых вузов: {created}")
    print(f"Записей численности добавлено: {inserted}")
    print(f"Записей численности обновлено: {updated}")


def import_batch(rows, conn_params):
    total = len(rows)
    print(f"Подключаюсь к PostgreSQL. Строк к загрузке: {total}", flush=True)
    with psycopg.connect(**conn_params) as conn, conn.cursor() as cur:
        cur.execute("""
            CREATE TEMP TABLE student_count_import (
                name text NOT NULL, year integer NOT NULL, amount integer NOT NULL,
                PRIMARY KEY (name, year)
            ) ON COMMIT DROP
        """)
        print("Подключение установлено. Передаю строки в PostgreSQL…", flush=True)
        with cur.copy("COPY student_count_import (name, year, amount) FROM STDIN") as copy:
            for index, ((name, year), amount) in enumerate(rows.items(), start=1):
                copy.write_row((name, year, amount))
                if index % 500 == 0 or index == total:
                    print(f"Передача строк: обработано {index} из {total}", flush=True)

        print("Данные переданы. Применяю изменения в PostgreSQL…", flush=True)
        cur.execute("SET LOCAL lock_timeout = '5s'")
        cur.execute("""
            LOCK TABLE public.institutions, public.students_amounts
            IN SHARE ROW EXCLUSIVE MODE
        """)
        cur.execute("""
            INSERT INTO public.institutions (inst_name)
            SELECT DISTINCT s.name
            FROM student_count_import AS s
            WHERE NOT EXISTS (
                SELECT 1 FROM public.institutions AS i WHERE i.inst_name = s.name
            )
        """)
        created = cur.rowcount
        print(f"Вузов добавлено в транзакции: {created}", flush=True)

        cur.execute("""
            CREATE TEMP TABLE student_count_targets ON COMMIT DROP AS
            SELECT min(i.inst_id) AS inst_id, s.year, s.amount
            FROM student_count_import AS s
            JOIN public.institutions AS i ON i.inst_name = s.name
            GROUP BY s.name, s.year, s.amount
        """)
        cur.execute("""
            UPDATE public.students_amounts AS current
            SET amount_of_students = incoming.amount
            FROM student_count_targets AS incoming
            WHERE current.inst_id = incoming.inst_id AND current.year = incoming.year
              AND current.amount_of_students IS DISTINCT FROM incoming.amount
        """)
        updated = cur.rowcount
        cur.execute("""
            INSERT INTO public.students_amounts (inst_id, year, amount_of_students)
            SELECT incoming.inst_id, incoming.year, incoming.amount
            FROM student_count_targets AS incoming
            WHERE NOT EXISTS (
                SELECT 1 FROM public.students_amounts AS existing
                WHERE existing.inst_id = incoming.inst_id AND existing.year = incoming.year
            )
        """)
        inserted = cur.rowcount
        unchanged = total - inserted - updated
        print(
            f"Численность в транзакции: добавлено {inserted}, "
            f"обновлено {updated}, без изменений {unchanged}. Сохраняю…",
            flush=True,
        )

    print("Импорт завершён. Изменения сохранены в БД.", flush=True)
    return created, inserted, updated


if __name__ == "__main__":
    main()
