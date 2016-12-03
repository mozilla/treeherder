# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0043_bugscache_cleanup'),
    ]

    operations = [
        migrations.AlterField(
            model_name='jobgroup',
            name='symbol',
            field=models.CharField(default='?', max_length=25, db_index=True),
        ),
        migrations.AlterField(
            model_name='jobtype',
            name='symbol',
            field=models.CharField(default='?', max_length=25, db_index=True),
        ),
    ]
