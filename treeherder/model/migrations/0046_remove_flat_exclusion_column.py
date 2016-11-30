# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0045_add_similar_job_indexes'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='exclusionprofile',
            name='flat_exclusion',
        ),
    ]
