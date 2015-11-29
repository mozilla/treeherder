# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0006_performancesignature_subtests'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancesignature',
            name='subtests',
            field=models.ManyToManyField(to='perf.PerformanceSignature', blank=True),
        ),
    ]
