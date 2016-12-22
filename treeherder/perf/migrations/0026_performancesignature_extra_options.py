# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0025_rename_orm_property'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancesignature',
            name='extra_options',
            field=models.CharField(max_length=60, blank=True),
        ),
    ]
