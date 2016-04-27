# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0018_merge_duplicate_classifications'),
    ]

    operations = [
        migrations.AlterField(
            model_name='classifiedfailure',
            name='bug_number',
            field=models.PositiveIntegerField(unique=True, null=True, blank=True),
        ),
    ]
