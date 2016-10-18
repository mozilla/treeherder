# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0038_text_log_db'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='textlogsummary',
            name='bug_suggestions_artifact_id',
        ),
        migrations.RemoveField(
            model_name='textlogsummary',
            name='text_log_summary_artifact_id',
        ),
    ]
