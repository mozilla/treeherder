
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('model', '0032_rename_failureline_job_guid_repository_failure_lin_job_gui_b67c6d_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='TextLogError',
            name='new_failure',
            field=models.BooleanField(default=True),
        ),
    ]
