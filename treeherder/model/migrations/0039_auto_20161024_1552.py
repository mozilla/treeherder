# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0038_text_log_db'),
    ]

    operations = [
        migrations.AddField(
            model_name='exclusionprofile',
            name='author_email',
            field=models.CharField(default='', max_length=255),
        ),
        migrations.AddField(
            model_name='jobexclusion',
            name='author_email',
            field=models.CharField(default='', max_length=255),
        ),
    ]
