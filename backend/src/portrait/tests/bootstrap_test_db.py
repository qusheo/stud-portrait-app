"""
Подготовка тестовой БД для pytest (--reuse-db --no-migrations).

Django не создаёт таблицы unmanaged-моделей (managed=False), а syncdb
падает на FK из managed-моделей к ним. Скрипт создаёт тестовую базу,
unmanaged-таблицы и затем managed-таблицы через syncdb.

Запуск из backend/src: python -m portrait.tests.bootstrap_test_db
Переменные окружения подключения те же, что у Django (DB_* из .env).
"""

import os
import sys

import django
import psycopg


def main():
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "studportrait.settings")
    django.setup()

    from django.conf import settings
    from django.db import connection

    db_config = settings.DATABASES["default"]
    test_db_name = db_config["TEST"].get("NAME") or f"test_{db_config['NAME']}"

    conn_params = {
        "dbname": db_config["NAME"],
        "user": db_config["USER"],
        "password": db_config["PASSWORD"],
        "host": db_config["HOST"],
        "port": db_config["PORT"],
    }

    with psycopg.connect(**conn_params, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (test_db_name,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{test_db_name}"')
            print(f"created database {test_db_name}")

    connection.close()
    settings.DATABASES["default"]["NAME"] = test_db_name

    from portrait.tests.base import create_test_tables

    create_test_tables()

    settings.MIGRATION_MODULES = {
        app.label: None for app in django.apps.apps.get_app_configs()
    }
    from django.core.management import call_command

    call_command("migrate", run_syncdb=True, verbosity=0)
    print(f"test database {test_db_name} is ready")
    return 0


if __name__ == "__main__":
    sys.exit(main())
