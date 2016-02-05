# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0009_textlogsummary_textlogsummaryline'),
    ]

    operations = [
        migrations.AddField(
            model_name='textlogsummaryline',
            name='bug_number',
            field=models.PositiveIntegerField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name='textlogsummaryline',
            name='verified',
            field=models.BooleanField(default=False),
        ),
    ]
