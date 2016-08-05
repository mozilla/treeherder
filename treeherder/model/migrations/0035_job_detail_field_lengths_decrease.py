# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0034_add_unique_together_build_machine_platform'),
    ]

    operations = [
        # Trim the size of the values to meet the new size constraints
        migrations.RunSQL(
            ("UPDATE job_detail SET "
             "  title = SUBSTRING(title, 1, 70), "
             "  value = SUBSTRING(value, 1, 125)")
        ),
        migrations.AlterField(
            model_name='jobdetail',
            name='title',
            field=models.CharField(max_length=70, null=True),
        ),
        migrations.AlterField(
            model_name='jobdetail',
            name='value',
            field=models.CharField(max_length=125),
        ),
    ]
