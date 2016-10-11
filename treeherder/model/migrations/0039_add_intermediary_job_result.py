# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0038_text_log_db'),
    ]

    operations = [
        migrations.AddField(
            model_name='job',
            name='result',
            field=models.IntegerField(default=8, choices=[(1, 'success'), (2, 'testfailed'), (3, 'busted'), (4, 'skipped'), (5, 'exception'), (6, 'retry'), (7, 'usercancel'), (8, 'unknown')]),
        ),
    ]
