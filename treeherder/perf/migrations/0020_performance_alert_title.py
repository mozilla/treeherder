# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0019_performancealert_classifier'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancealert',
            name='title',
            field=models.CharField(max_length=255, blank=True),
        ),
    ]
