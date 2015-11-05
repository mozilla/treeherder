# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0002_auto_20151014_0922'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancesignature',
            name='lower_is_better',
            field=models.BooleanField(default=True),
        ),
    ]
