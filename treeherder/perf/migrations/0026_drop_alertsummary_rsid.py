# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0025_rename_orm_property'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='performancealertsummary',
            name='prev_result_set_id',
        ),
        migrations.RemoveField(
            model_name='performancealertsummary',
            name='result_set_id',
        ),
    ]
