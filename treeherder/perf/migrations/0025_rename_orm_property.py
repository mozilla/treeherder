# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0024_rename_ds_job_id_column'),
    ]

    operations = [
        migrations.RenameField(
            model_name='performancedatum',
            old_name='job_id',
            new_name='ds_job_id',
        ),
        migrations.AlterUniqueTogether(
            name='performancedatum',
            unique_together=set([('repository', 'ds_job_id', 'push', 'signature'), ('repository', 'ds_job_id', 'result_set_id', 'signature', 'push_timestamp')]),
        ),
        migrations.AlterIndexTogether(
            name='performancedatum',
            index_together=set([('repository', 'ds_job_id'), ('repository', 'signature', 'push_timestamp')]),
        ),
    ]
