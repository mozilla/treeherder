# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0002_auto_20151014_0900'),
    ]

    operations = [
        migrations.AlterField(
            model_name='referencedatasignatures',
            name='build_platform',
            field=models.CharField(max_length=100, db_index=True),
        ),
        migrations.AlterField(
            model_name='referencedatasignatures',
            name='machine_platform',
            field=models.CharField(max_length=100, db_index=True),
        ),
    ]
