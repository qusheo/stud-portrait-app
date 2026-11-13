
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from portrait.models import User as PortraitUser


class Command(BaseCommand):
    help = "Создание тестовых пользователей StudPortrait"

    def handle(self, *args, **options):
        DjangoUser = get_user_model()

        test_users = [
            ("seed_admin", "admin"),
            ("seed_centre", "centre"),
            ("seed_institution_admin", "institution_admin"),
            ("seed_teacher", "teacher"),
            ("seed_student", "student"),
        ]

        password = "StudPortrait-Test-2026!"

        for username, role in test_users:
            user, created = DjangoUser.objects.get_or_create(
                username=username
            )

            if created:
                user.set_password(password)

            user.is_staff = role == "admin"
            user.is_superuser = role == "admin"
            user.save()

            PortraitUser.objects.update_or_create(
                django_user=user,
                defaults={"account_type": role},
            )

            status = "создан" if created else "обновлён"
            self.stdout.write(
                self.style.SUCCESS(
                    f"{username}: роль {role}, пользователь {status}"
                )
            )

        self.stdout.write(
            self.style.SUCCESS(
                "Готово. Пароль новых тестовых пользователей: "
                + password
            )
        )
