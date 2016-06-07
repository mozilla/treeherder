# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0026_failure_line_job_log_id'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='jobdetail',
            unique_together=set([('job', 'title', 'value', 'url')]),
        ),
    ]
