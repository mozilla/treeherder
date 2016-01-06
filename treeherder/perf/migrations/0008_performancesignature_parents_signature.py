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
            name='parents_signature',
            field=models.ForeignKey(blank=True, to='perf.PerformanceSignature', null=True),
        ),
    ]
