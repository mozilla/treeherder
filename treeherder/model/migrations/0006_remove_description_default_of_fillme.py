# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0005_add_job_duration_table'),
    ]

    operations = [
        migrations.AlterField(
            model_name='failureclassification',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='jobgroup',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='jobtype',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='option',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='product',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='repository',
            name='description',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='repositorygroup',
            name='description',
            field=models.TextField(blank=True),
        ),
    ]
