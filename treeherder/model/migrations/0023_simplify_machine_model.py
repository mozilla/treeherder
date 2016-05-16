# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0022_add_index_failureline_signature'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='machine',
            name='active_status',
        ),
        migrations.RemoveField(
            model_name='machine',
            name='first_timestamp',
        ),
        migrations.RemoveField(
            model_name='machine',
            name='last_timestamp',
        ),
    ]
