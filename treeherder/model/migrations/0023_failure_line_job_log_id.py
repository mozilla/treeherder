# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0022_add_index_failureline_signature'),
    ]

    operations = [
        migrations.AddField(
            model_name='failureline',
            name='job_log_id',
            field=models.BigIntegerField(null=True),
        ),
        migrations.AddField(
            model_name='failureline',
            name='project_log_id',
            field=models.BigIntegerField(null=True),
        ),
        migrations.AlterUniqueTogether(
            name='failureline',
            unique_together=set([('job_guid', 'line', 'repository', 'project_log_id')]),
        ),
    ]
