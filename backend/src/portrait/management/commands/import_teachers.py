from django.core.management.base import BaseCommand

from portrait.models import Teachers
from portrait.teacher_parser import DEFAULT_TEACHER_SOURCE_URLS, parse_teachers


class Command(BaseCommand):
    help = "Парсит преподавателей с официальных страниц ТюмГУ и сохраняет их в БД"

    def add_arguments(self, parser):
        parser.add_argument(
            "--source-url",
            action="append",
            dest="source_urls",
            help="Страница ТюмГУ со списком преподавателей. Можно передать несколько раз.",
        )
        parser.add_argument(
            "--no-lms",
            action="store_true",
            help="Не искать курсы повышения квалификации на LMS ТюмГУ.",
        )

    def handle(self, *args, **options):
        source_urls = options["source_urls"] or DEFAULT_TEACHER_SOURCE_URLS
        include_lms = not options["no_lms"]

        profiles = parse_teachers(source_urls=source_urls, include_lms=include_lms)
        saved = 0

        for profile in profiles:
            Teachers.objects.update_or_create(
                full_name=profile.full_name,
                defaults={
                    "position": profile.position or None,
                    "degree": profile.degree or None,
                    "department": profile.department or None,
                    "email": profile.email or None,
                    "profile_url": profile.profile_url or None,
                    "source_url": profile.source_url or None,
                    "interests": profile.interests,
                    "qualification_courses": profile.qualification_courses,
                    "publications": profile.publications,
                    "projects": profile.projects,
                    "modeus_disciplines": profile.modeus_disciplines,
                    "raw_profile": profile.raw_profile,
                },
            )
            saved += 1

        self.stdout.write(self.style.SUCCESS(f"Сохранено преподавателей: {saved}"))
