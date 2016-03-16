# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0011_auto_20160316_1023'),
    ]

    operations = [
        migrations.AlterField(
            model_name='buildplatform',
            name='platform',
            field=models.CharField(max_length=100, db_index=True),
        ),
        migrations.AlterField(
            model_name='machineplatform',
            name='platform',
            field=models.CharField(max_length=100, db_index=True),
        ),
    ]
