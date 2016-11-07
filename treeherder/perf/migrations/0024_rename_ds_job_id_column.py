# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0023_push_and_commit_orm_2'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancedatum',
            name='job_id',
            field=models.PositiveIntegerField(db_column=b'ds_job_id'),
        ),
    ]
