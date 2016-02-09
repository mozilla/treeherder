# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0004_auto_20151116_1041'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancealert',
            name='amount_abs',
            field=models.FloatField(help_text=b'Absolute amount that series has changed'),
        ),
        migrations.AlterField(
            model_name='performancealert',
            name='amount_pct',
            field=models.FloatField(help_text=b'Amount in percentage that series has changed'),
        ),
        migrations.AlterField(
            model_name='performancealert',
            name='new_value',
            field=models.FloatField(help_text=b'New value of series after change'),
        ),
        migrations.AlterField(
            model_name='performancealert',
            name='prev_value',
            field=models.FloatField(help_text=b'Previous value of series before change'),
        ),
        migrations.AlterField(
            model_name='performancealert',
            name='summary',
            field=models.ForeignKey(related_name='alerts', to='perf.PerformanceAlertSummary'),
        ),
        migrations.AlterField(
            model_name='performancealert',
            name='t_value',
            field=models.FloatField(help_text=b"t value out of analysis indicating confidence that change is 'real'"),
        ),
    ]
