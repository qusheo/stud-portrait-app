from django.db import migrations, models
import django.db.models.deletion


INSTITUTION_NAME = 'Тюменский государственный университет'


def education_type(value):
    value = (value or '').strip()
    lower = value.casefold()
    types = []
    for fragment, label in [('бакалавр', 'Бакалавриат'), ('магистр', 'Магистратура'), ('специалитет', 'Специалитет'), ('аспирантур', 'Аспирантура')]:
        if fragment in lower:
            types.append(label)
    return ', '.join(types) if types else value


def gender_from_name(name):
    parts = (name or '').split()
    if len(parts) >= 3:
        patronymic = parts[2].casefold()
        if patronymic.endswith(('вич', 'ич')):
            return 'Мужской'
        if patronymic.endswith(('вна', 'ична')):
            return 'Женский'
    if parts:
        surname = parts[0].casefold()
        if surname.endswith(('ова', 'ева', 'ина', 'ская', 'цкая')):
            return 'Женский'
        if surname.endswith(('ов', 'ев', 'ин', 'ский', 'цкий')):
            return 'Мужской'
    return None


def nullable_title(value):
    value = (value or '').strip()
    if not value or value.casefold().startswith(('нет', 'отсутствует', 'не имеет', 'не присвоено', 'без учен')):
        return None
    return value


def move_teacher_data(apps, schema_editor):
    alias = schema_editor.connection.alias
    Teacher = apps.get_model('portrait', 'Teacher')
    Institution = apps.get_model('portrait', 'Institutions')
    Education = apps.get_model('portrait', 'TeacherEducation')
    Discipline = apps.get_model('portrait', 'TeacherDiscipline')
    institution = Institution.objects.using(alias).filter(inst_name__iexact=INSTITUTION_NAME).first()
    if institution is None:
        institution = Institution.objects.using(alias).create(inst_name=INSTITUTION_NAME)
    for teacher in Teacher.objects.using(alias).all().iterator():
        parts = teacher.education_details if isinstance(teacher.education_details, list) else []
        level = education_type(parts[0] if parts else teacher.edu_level)
        direction = ' '.join(parts[1:-1]) if len(parts) > 2 else (parts[1] if len(parts) == 2 else '')
        qualification = parts[-1] if len(parts) > 2 else (teacher.qualification or '')
        if level or direction or qualification:
            Education.objects.using(alias).get_or_create(teacher_id=teacher.id, education_type=level, direction=direction, qualification=qualification)
        for name in dict.fromkeys(teacher.disciplines or []):
            if name:
                Discipline.objects.using(alias).get_or_create(teacher_id=teacher.id, name=name)
        teacher.institution_ref_id = institution.pk
        teacher.gender = gender_from_name(teacher.name)
        teacher.academic_degree = nullable_title(teacher.academic_degree)
        teacher.academic_title = nullable_title(teacher.academic_title)
        teacher.save(using=alias, update_fields=['institution_ref', 'gender', 'academic_degree', 'academic_title'])


class Migration(migrations.Migration):
    dependencies = [('portrait', '0012_teacher_table_and_seed')]

    operations = [
        # Таблица institutions управляется вне Django (managed = False) и на части
        # стендов создана без PRIMARY KEY, без которого FK ниже не создаётся.
        migrations.RunSQL(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conrelid = 'institutions'::regclass AND contype = 'p'
                ) THEN
                    ALTER TABLE institutions ADD PRIMARY KEY (inst_id);
                END IF;
            END $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.CreateModel(
            name='TeacherEducation',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('education_type', models.CharField(max_length=512)),
                ('direction', models.TextField(blank=True)),
                ('qualification', models.TextField(blank=True)),
                ('teacher', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='educations', to='portrait.teacher')),
            ],
            options={'db_table': 'teacher_education'},
        ),
        migrations.CreateModel(
            name='TeacherDiscipline',
            fields=[
                ('id', models.BigAutoField(primary_key=True, serialize=False)),
                ('name', models.TextField()),
                ('teacher', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='discipline_rows', to='portrait.teacher')),
            ],
            options={'db_table': 'teacher_discipline'},
        ),
        migrations.AddField(
            model_name='teacher',
            name='institution_ref',
            field=models.ForeignKey(blank=True, db_column='institution_id', null=True, on_delete=django.db.models.deletion.PROTECT, related_name='teachers', to='portrait.institutions'),
        ),
        migrations.RunPython(move_teacher_data, reverse_code=migrations.RunPython.noop),
        migrations.RemoveField('teacher', 'disciplines'),
        migrations.RemoveField('teacher', 'education_details'),
        migrations.RemoveField('teacher', 'edu_level'),
        migrations.RemoveField('teacher', 'qualification'),
        migrations.RemoveField('teacher', 'experience_text'),
        migrations.RemoveField('teacher', 'institution'),
        migrations.AlterField(
            model_name='teacher',
            name='institution_ref',
            field=models.ForeignKey(db_column='institution_id', on_delete=django.db.models.deletion.PROTECT, related_name='teachers', to='portrait.institutions'),
        ),
        migrations.RenameField('teacher', 'institution_ref', 'institution'),
        migrations.AddConstraint('teachereducation', models.UniqueConstraint(fields=['teacher', 'education_type', 'direction', 'qualification'], name='unique_teacher_education')),
        migrations.AddConstraint('teacherdiscipline', models.UniqueConstraint(fields=['teacher', 'name'], name='unique_teacher_discipline')),
    ]
