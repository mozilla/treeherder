# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0007_alert_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancesignature',
            name='subtests',
            field=models.ManyToManyField(to='perf.PerformanceSignature', blank=True),
        ),
    ]
