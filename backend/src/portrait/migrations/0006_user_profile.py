from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("portrait", "0005_rename_results_course_column"),
    ]

    operations = [
        migrations.CreateModel(
            name="User",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("account_type", models.CharField(choices=[
                    ("admin", "Администратор"),
                    ("centre", "Центр"),
                    ("institution_admin", "Администратор учреждения"),
                    ("teacher", "Преподаватель"),
                    ("student", "Студент"),
                ], default="admin", max_length=32)),
                ("django_user", models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="portrait_account",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"db_table": "portrait_user"},
        ),
    ]