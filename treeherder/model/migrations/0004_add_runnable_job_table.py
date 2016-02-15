# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0003_auto_20151111_0942'),
    ]

    operations = [
        migrations.CreateModel(
            name='RunnableJob',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('option_collection_hash', models.CharField(max_length=64)),
                ('ref_data_name', models.CharField(max_length=255)),
                ('build_system_type', models.CharField(max_length=25)),
                ('last_touched', models.DateTimeField(auto_now=True)),
                ('build_platform', models.ForeignKey(to='model.BuildPlatform')),
                ('job_type', models.ForeignKey(to='model.JobType')),
                ('machine_platform', models.ForeignKey(to='model.MachinePlatform')),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'runnable_job',
            },
        ),
        migrations.AlterUniqueTogether(
            name='runnablejob',
            unique_together=set([('ref_data_name', 'build_system_type')]),
        ),
    ]
