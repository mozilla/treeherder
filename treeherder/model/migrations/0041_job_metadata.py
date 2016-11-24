# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0040_push_and_commit_orm_2'),
    ]

    operations = [
        migrations.AddField(
            model_name='job',
            name='build_platform',
            field=models.ForeignKey(default=None, to='model.BuildPlatform', null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='coalesced_to_guid',
            field=models.CharField(default=None, max_length=50, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='end_time',
            field=models.DateTimeField(default=None, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='failure_classification',
            field=models.ForeignKey(default=None, to='model.FailureClassification', null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='job_type',
            field=models.ForeignKey(default=None, to='model.JobType', null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='last_modified',
            field=models.DateTimeField(default=None, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='machine',
            field=models.ForeignKey(default=None, to='model.Machine', null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='machine_platform',
            field=models.ForeignKey(default=None, to='model.MachinePlatform', null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='option_collection_hash',
            field=models.CharField(default=None, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='product',
            field=models.ForeignKey(default=None, to='model.Product', null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='reason',
            field=models.CharField(default=None, max_length=125, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='result',
            field=models.CharField(default=None, max_length=25, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='running_eta',
            field=models.PositiveIntegerField(default=None, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='signature',
            field=models.ForeignKey(default=None, to='model.ReferenceDataSignatures', null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='start_time',
            field=models.DateTimeField(default=None, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='state',
            field=models.CharField(default=None, max_length=25, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='submit_time',
            field=models.DateTimeField(default=None, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='tier',
            field=models.PositiveIntegerField(default=None, null=True),
        ),
        migrations.AddField(
            model_name='job',
            name='who',
            field=models.CharField(default=None, max_length=50, null=True),
        ),
    ]
