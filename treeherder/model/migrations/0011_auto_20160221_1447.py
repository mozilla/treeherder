# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0010_auto_20160219_0300'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='textlogsummary',
            unique_together=set([('job_guid', 'repository')]),
        ),
    ]
