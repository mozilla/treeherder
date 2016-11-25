# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0041_job_metadata'),
    ]

    operations = [
        migrations.DeleteModel(
            name='TaskSetMeta',
        ),
    ]
