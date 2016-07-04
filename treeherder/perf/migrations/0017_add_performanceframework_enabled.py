# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0016_manually_created_alerts'),
    ]

    operations = [
        migrations.AddField(
            model_name='performanceframework',
            name='enabled',
            field=models.BooleanField(default=False),
        ),
    ]
