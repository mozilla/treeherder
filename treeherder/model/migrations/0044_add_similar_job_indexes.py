# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0043_bugscache_cleanup'),
    ]

    operations = [
        migrations.AlterIndexTogether(
            name='job',
            index_together=set([('repository', 'option_collection_hash', 'job_type', 'start_time'), ('repository', 'job_type', 'start_time'), ('repository', 'build_platform', 'option_collection_hash', 'job_type', 'start_time'), ('repository', 'build_platform', 'job_type', 'start_time')]),
        ),
    ]
