# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0046_remove_flat_exclusion_column'),
    ]

    operations = [
        migrations.AlterField(
            model_name='job',
            name='build_platform',
            field=models.ForeignKey(to='model.BuildPlatform'),
        ),
        migrations.AlterField(
            model_name='job',
            name='end_time',
            field=models.DateTimeField(),
        ),
        migrations.AlterField(
            model_name='job',
            name='failure_classification',
            field=models.ForeignKey(to='model.FailureClassification'),
        ),
        migrations.AlterField(
            model_name='job',
            name='job_type',
            field=models.ForeignKey(to='model.JobType'),
        ),
        migrations.AlterField(
            model_name='job',
            name='last_modified',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AlterField(
            model_name='job',
            name='machine',
            field=models.ForeignKey(to='model.Machine'),
        ),
        migrations.AlterField(
            model_name='job',
            name='machine_platform',
            field=models.ForeignKey(to='model.MachinePlatform'),
        ),
        migrations.AlterField(
            model_name='job',
            name='option_collection_hash',
            field=models.CharField(max_length=64),
        ),
        migrations.AlterField(
            model_name='job',
            name='product',
            field=models.ForeignKey(to='model.Product'),
        ),
        migrations.AlterField(
            model_name='job',
            name='reason',
            field=models.CharField(max_length=125),
        ),
        migrations.AlterField(
            model_name='job',
            name='result',
            field=models.CharField(max_length=25),
        ),
        migrations.AlterField(
            model_name='job',
            name='signature',
            field=models.ForeignKey(to='model.ReferenceDataSignatures'),
        ),
        migrations.AlterField(
            model_name='job',
            name='start_time',
            field=models.DateTimeField(),
        ),
        migrations.AlterField(
            model_name='job',
            name='state',
            field=models.CharField(max_length=25),
        ),
        migrations.AlterField(
            model_name='job',
            name='submit_time',
            field=models.DateTimeField(),
        ),
        migrations.AlterField(
            model_name='job',
            name='tier',
            field=models.PositiveIntegerField(),
        ),
        migrations.AlterField(
            model_name='job',
            name='who',
            field=models.CharField(max_length=50),
        ),
    ]
