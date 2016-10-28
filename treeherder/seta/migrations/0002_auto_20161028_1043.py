# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('seta', '0001_squashed_0002_auto_20161020_1354'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='jobpriority',
            name='expires',
        ),
        migrations.AddField(
            model_name='jobpriority',
            name='expiration_date',
            field=models.DateTimeField(null=True),
        ),
    ]
