# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0035_job_detail_field_lengths_decrease'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='jobdetail',
            unique_together=set([('title', 'value', 'job')]),
        ),
    ]
