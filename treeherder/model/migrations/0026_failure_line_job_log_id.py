# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0025_add_joblog'),
    ]

    operations = [
        migrations.AddField(
            model_name='failureline',
            name='job_log',
            field=treeherder.model.fields.FlexibleForeignKey(to='model.JobLog', null=True),
        ),
        migrations.AlterUniqueTogether(
            name='failureline',
            unique_together=set([('job_log', 'line')]),
        ),
    ]
