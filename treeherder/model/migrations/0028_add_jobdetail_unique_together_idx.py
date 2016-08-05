# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0027_failure_line_idx_signature_test'),
    ]

    operations = [
        migrations.AlterField(
            model_name='jobdetail',
            name='title',
            field=models.CharField(max_length=100, null=True),
        ),
        migrations.AlterUniqueTogether(
            name='jobdetail',
            unique_together=set([('job', 'title', 'value')]),
        ),
    ]
