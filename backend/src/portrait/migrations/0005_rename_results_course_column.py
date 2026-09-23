from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('portrait', '0004_rename_results_specialty_column'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'results'
                          AND column_name = 'res_course_num'
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'results'
                          AND column_name = 'res_course'
                    ) THEN
                        ALTER TABLE results
                        RENAME COLUMN res_course_num TO res_course;
                    END IF;
                END
                $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
