from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('portrait', '0003_alter_courseresults_table'),
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
                          AND column_name = 'res_spec'
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'results'
                          AND column_name = 'res_edu_specialty'
                    ) THEN
                        ALTER TABLE results
                        RENAME COLUMN res_spec TO res_edu_specialty;
                    END IF;
                END
                $$;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
