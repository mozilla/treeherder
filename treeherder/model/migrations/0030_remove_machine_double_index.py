# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0029_remove_named_model_metadata'),
    ]

    operations = [
        migrations.AlterField(
            model_name='machine',
            name='name',
            field=models.CharField(unique=True, max_length=50),
        ),
    ]
