# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0036_job_details_unique_together'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='buildplatform',
            name='active_status',
        ),
        migrations.RemoveField(
            model_name='jobgroup',
            name='active_status',
        ),
        migrations.RemoveField(
            model_name='jobtype',
            name='active_status',
        ),
        migrations.RemoveField(
            model_name='machineplatform',
            name='active_status',
        ),
    ]
