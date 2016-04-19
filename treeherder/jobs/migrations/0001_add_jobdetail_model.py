# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='JobDetail',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('job_guid', models.CharField(max_length=50, db_index=True)),
                ('title', models.CharField(max_length=200, null=True)),
                ('value', models.CharField(max_length=200)),
                ('url', models.URLField(null=True)),
            ],
            options={
                'db_table': 'job_detail',
            },
        ),
    ]
