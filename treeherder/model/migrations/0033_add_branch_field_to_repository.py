# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0032_bugjobmap_jobnote_models'),
    ]

    operations = [
        migrations.AddField(
            model_name='repository',
            name='branch',
            field=models.CharField(max_length=50, null=True, db_index=True),
        ),
    ]
