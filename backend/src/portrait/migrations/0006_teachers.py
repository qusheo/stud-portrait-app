from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("portrait", "0005_rename_results_course_column"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
            CREATE TABLE IF NOT EXISTS Teachers (
                teacher_id             INTEGER        PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                full_name              VARCHAR(512)   UNIQUE NOT NULL,
                position               VARCHAR(1024),
                degree                 VARCHAR(512),
                department             VARCHAR(1024),
                email                  VARCHAR(256),
                profile_url            VARCHAR(1024),
                source_url             VARCHAR(1024),
                interests              JSONB          NOT NULL DEFAULT '[]'::jsonb,
                qualification_courses  JSONB          NOT NULL DEFAULT '[]'::jsonb,
                publications           JSONB          NOT NULL DEFAULT '[]'::jsonb,
                projects               JSONB          NOT NULL DEFAULT '[]'::jsonb,
                modeus_disciplines     JSONB          NOT NULL DEFAULT '[]'::jsonb,
                raw_profile            JSONB          NOT NULL DEFAULT '{}'::jsonb,
                parsed_at              TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS degree VARCHAR(512);
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS source_url VARCHAR(1024);
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS interests JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS qualification_courses JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS publications JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS projects JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS modeus_disciplines JSONB NOT NULL DEFAULT '[]'::jsonb;
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb;
            ALTER TABLE Teachers ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
            CREATE INDEX IF NOT EXISTS idx_teachers_full_name ON Teachers(full_name);
            CREATE INDEX IF NOT EXISTS idx_teachers_department ON Teachers(department);

            CREATE TABLE IF NOT EXISTS TeacherParseLog (
                id              INTEGER       PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
                started_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                finished_at     TIMESTAMP,
                status          VARCHAR(16)   NOT NULL DEFAULT 'running',
                source_urls     JSONB         NOT NULL DEFAULT '[]'::jsonb,
                teachers_found  INTEGER      NOT NULL DEFAULT 0,
                teachers_saved  INTEGER      NOT NULL DEFAULT 0,
                error_message   TEXT         NOT NULL DEFAULT ''
            );
            """,
                    reverse_sql="""
            DROP TABLE IF EXISTS TeacherParseLog;
            DROP TABLE IF EXISTS Teachers;
            """,
                ),
            ],
            state_operations=[
                migrations.CreateModel(
                    name="Teachers",
                    fields=[
                        ("teacher_id", models.AutoField(primary_key=True, serialize=False)),
                        ("full_name", models.CharField(max_length=512, unique=True)),
                        ("position", models.CharField(blank=True, max_length=1024, null=True)),
                        ("degree", models.CharField(blank=True, max_length=512, null=True)),
                        ("department", models.CharField(blank=True, max_length=1024, null=True)),
                        ("email", models.CharField(blank=True, max_length=256, null=True)),
                        ("profile_url", models.URLField(blank=True, max_length=1024, null=True)),
                        ("source_url", models.URLField(blank=True, max_length=1024, null=True)),
                        ("interests", models.JSONField(default=list)),
                        ("qualification_courses", models.JSONField(default=list)),
                        ("publications", models.JSONField(default=list)),
                        ("projects", models.JSONField(default=list)),
                        ("modeus_disciplines", models.JSONField(default=list)),
                        ("raw_profile", models.JSONField(default=dict)),
                        ("parsed_at", models.DateTimeField(auto_now=True)),
                    ],
                    options={
                        "db_table": "teachers",
                        "ordering": ["full_name"],
                        "managed": False,
                    },
                ),
                migrations.CreateModel(
                    name="TeacherParseLog",
                    fields=[
                        ("id", models.AutoField(primary_key=True, serialize=False)),
                        ("started_at", models.DateTimeField(auto_now_add=True)),
                        ("finished_at", models.DateTimeField(blank=True, null=True)),
                        (
                            "status",
                            models.CharField(
                                choices=[
                                    ("running", "Выполняется"),
                                    ("success", "Успешно"),
                                    ("error", "Ошибка"),
                                ],
                                default="running",
                                max_length=16,
                            ),
                        ),
                        ("source_urls", models.JSONField(default=list)),
                        ("teachers_found", models.IntegerField(default=0)),
                        ("teachers_saved", models.IntegerField(default=0)),
                        ("error_message", models.TextField(blank=True)),
                    ],
                    options={
                        "db_table": "teacherparselog",
                        "ordering": ["-started_at"],
                        "managed": False,
                    },
                ),
            ],
        ),
    ]
