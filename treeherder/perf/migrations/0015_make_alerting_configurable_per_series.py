# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0014_allow_same_signature_hash_different_frameworks'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancesignature',
            name='alert_threshold',
            field=models.FloatField(null=True),
        ),
        migrations.AddField(
            model_name='performancesignature',
            name='fore_window',
            field=models.IntegerField(null=True),
        ),
        migrations.AddField(
            model_name='performancesignature',
            name='max_back_window',
            field=models.IntegerField(null=True),
        ),
        migrations.AddField(
            model_name='performancesignature',
            name='min_back_window',
            field=models.IntegerField(null=True),
        ),
        migrations.AddField(
            model_name='performancesignature',
            name='should_alert',
            field=models.NullBooleanField(),
        ),
    ]
