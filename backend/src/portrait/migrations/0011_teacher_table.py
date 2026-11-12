# Maps the Teacher model onto the existing `teacher` table (populated by the
# directory pipeline). No database operations: the table already exists.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('portrait', '0010_teachers'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RenameModel('Teachers', 'Teacher'),
                migrations.RenameField('Teacher', 'teacher_id', 'id'),
                migrations.AlterModelTable('Teacher', 'teacher'),
                migrations.AddField(
                    'Teacher',
                    'source_url',
                    models.TextField(default=''),
                ),
                migrations.AddField(
                    'Teacher',
                    'parsed_at',
                    models.DateTimeField(auto_now_add=True),
                ),
            ],
        ),
    ]
