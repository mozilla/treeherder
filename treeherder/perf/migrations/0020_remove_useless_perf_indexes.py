# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0019_performancealert_classifier'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancedatum',
            name='job_id',
            field=models.PositiveIntegerField(),
        ),
        migrations.AlterField(
            model_name='performancedatum',
            name='push_timestamp',
            field=models.DateTimeField(),
        ),
        migrations.AlterField(
            model_name='performancedatum',
            name='result_set_id',
            field=models.PositiveIntegerField(),
        ),
    ]
