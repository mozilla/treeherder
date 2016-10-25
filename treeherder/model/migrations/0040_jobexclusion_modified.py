# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import datetime


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0039_auto_20161024_1552'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobexclusion',
            name='modified',
            field=models.DateTimeField(default=datetime.datetime(2016, 10, 24, 15, 55, 58, 241053), auto_now=True),
            preserve_default=False,
        ),
    ]
