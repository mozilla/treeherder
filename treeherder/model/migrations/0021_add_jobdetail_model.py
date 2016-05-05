# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0020_update_job_name_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobDetail',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('title', models.CharField(max_length=200, null=True)),
                ('value', models.CharField(max_length=200)),
                ('url', models.URLField(null=True)),
                ('job', treeherder.model.fields.FlexibleForeignKey(to='model.Job')),
            ],
            options={
                'db_table': 'job_detail',
            },
        ),
    ]
