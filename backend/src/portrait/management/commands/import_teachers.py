from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from portrait.endpoints.parsers.teacher_directory_parser import SOURCE_URL, INSTITUTION, parse_teacher
from portrait.models import Institutions, Teacher, TeacherDiscipline, TeacherEducation


class Command(BaseCommand):
    def add_arguments(self, parser):
        parser.add_argument('html', type=Path)
        parser.add_argument('--min-rows', type=int, default=1000)
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        records = parse_teacher(options['html'].read_bytes())
        if len(records) < options['min_rows']:
            raise CommandError(f'Expected at least {options["min_rows"]} rows, got {len(records)}')
        if options['dry_run']:
            self.stdout.write(str(len(records)))
            return

        with transaction.atomic():
            institution = Institutions.objects.filter(inst_name__iexact=INSTITUTION).first()
            if institution is None:
                institution = Institutions.objects.create(inst_name=INSTITUTION)
            for record in records:
                teacher, _ = Teacher.objects.update_or_create(
                    source_row=record.source_row,
                    defaults={
                        'name': record.name,
                        'gender': record.gender,
                        'position': record.position,
                        'institution': institution,
                        'academic_degree': record.academic_degree,
                        'academic_title': record.academic_title,
                        'experience': record.experience,
                        'professional_development': record.professional_development,
                        'professional_retraining': record.professional_retraining,
                        'source_url': SOURCE_URL,
                    },
                )
                teacher.educations.all().delete()
                if record.education_type or record.direction or record.qualification:
                    TeacherEducation.objects.create(
                        teacher=teacher,
                        education_type=record.education_type,
                        direction=record.direction,
                        qualification=record.qualification,
                    )
                teacher.discipline_rows.all().delete()
                TeacherDiscipline.objects.bulk_create([
                    TeacherDiscipline(teacher=teacher, name=name)
                    for name in dict.fromkeys(record.disciplines)
                    if name
                ])
        self.stdout.write(str(len(records)))
