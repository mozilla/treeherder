# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0019_bug_number_unique'),
    ]

    operations = [
        migrations.AlterField(
            model_name='jobgroup',
            name='name',
            field=models.CharField(max_length=100, db_index=True),
        ),
        migrations.AlterField(
            model_name='jobtype',
            name='name',
            field=models.CharField(max_length=100, db_index=True),
        ),
    ]
