# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import datetime


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0039_push_and_commit_orm'),
    ]

    operations = [
        migrations.AddField(
            model_name='jobexclusion',
            name='modified',
            field=models.DateTimeField(default=datetime.datetime(2016, 11, 9, 13, 10, 48, 295116), auto_now=True),
            preserve_default=False,
        ),
    ]
