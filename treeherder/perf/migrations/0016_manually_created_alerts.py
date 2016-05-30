# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0015_make_alerting_configurable_per_series'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancealert',
            name='manually_created',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='performancealertsummary',
            name='manually_created',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='performancealert',
            name='t_value',
            field=models.FloatField(help_text=b"t value out of analysis indicating confidence that change is 'real'", null=True),
        ),
    ]
