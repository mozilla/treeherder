# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0012_longer_platform_names'),
    ]

    operations = [
        migrations.AddField(
            model_name='repository',
            name='performance_alerts_enabled',
            field=models.BooleanField(default=False),
        ),
    ]
