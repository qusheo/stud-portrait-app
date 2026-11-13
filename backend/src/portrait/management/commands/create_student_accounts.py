
import csv
import secrets
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from portrait.models import Participants, User as PortraitUser


class Command(BaseCommand):
    help = "Создание учётных записей для студентов"

    def add_arguments(self, parser):
        group = parser.add_mutually_exclusive_group()

        group.add_argument(
            "--limit",
            type=int,
            default=5,
            help="Количество аккаунтов для создания (по умолчанию 5)",
        )

        group.add_argument(
            "--all",
            action="store_true",
            help="Создать аккаунты для всех студентов без учётных записей",
        )

        parser.add_argument(
            "--output",
            type=str,
            default="student_accounts.csv",
            help="Путь к CSV-файлу с учётными данными",
        )

    def handle(self, *args, **options):
        limit = options["limit"]
        create_all = options["all"]
        output_path = Path(options["output"])

        if not create_all and limit <= 0:
            raise CommandError(
                "Количество аккаунтов должно быть больше нуля."
            )

        if output_path.exists():
            raise CommandError(
                f"Файл {output_path} уже существует. "
                "Выбери другое имя."
            )

        DjangoUser = get_user_model()

        students_query = (
            Participants.objects
            .filter(portrait_account__isnull=True)
            .order_by("part_id")
        )

        if not create_all:
            students_query = students_query[:limit]

        students = list(students_query)

        if not students:
            self.stdout.write(
                self.style.WARNING(
                    "Нет студентов для создания аккаунтов."
                )
            )
            return

        credentials = []

        # Подготавливаем логины и пароли.
        for participant in students:
            username = f"student_{participant.part_id}"

            if DjangoUser.objects.filter(username=username).exists():
                raise CommandError(
                    f"Логин {username} уже существует. "
                    "Проверь учётную запись вручную."
                )

            password = secrets.token_urlsafe(18)

            credentials.append({
                "part_id": participant.part_id,
                "rsv_id": participant.part_rsv_id,
                "display_name": f"Участник {participant.part_rsv_id}",
                "username": username,
                "password": password,
            })

        # Создаём папку и CSV до создания аккаунтов.
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            with output_path.open(
                "x",
                encoding="utf-8-sig",
                newline="",
            ) as csv_file:
                writer = csv.DictWriter(
                    csv_file,
                    fieldnames=[
                        "part_id",
                        "rsv_id",
                        "display_name",
                        "username",
                        "password",
                    ],
                )
                writer.writeheader()
                writer.writerows(credentials)

            # Создаём аккаунты в одной транзакции.
            with transaction.atomic():
                for participant, data in zip(students, credentials):
                    django_user = DjangoUser.objects.create_user(
                        username=data["username"],
                        password=data["password"],
                    )

                    PortraitUser.objects.create(
                        django_user=django_user,
                        account_type=PortraitUser.AccountType.STUDENT,
                        participant=participant,
                    )

        except Exception as error:
            if output_path.exists():
                output_path.unlink()

            raise CommandError(
                f"Не удалось создать аккаунты: {error}"
            ) from error

        self.stdout.write(
            self.style.SUCCESS(
                f"Создано аккаунтов: {len(credentials)}"
            )
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Файл с учётными данными: {output_path.resolve()}"
            )
        )
