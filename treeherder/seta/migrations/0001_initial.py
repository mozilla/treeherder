# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='JobPriorities',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('testtype', models.CharField(max_length=128)),
                ('buildtype', models.CharField(max_length=64)),
                ('platform', models.CharField(max_length=64)),
                ('priority', models.IntegerField()),
                ('timeout', models.IntegerField()),
                ('expires', models.DateTimeField()),
                ('buildsystem', models.CharField(max_length=64)),
            ],
        ),
        migrations.CreateModel(
            name='TaskRequests',
            fields=[
                ('repo_name', models.CharField(max_length=128, serialize=False, primary_key=True)),
                ('counter', models.IntegerField()),
                ('last_request', models.DateTimeField()),
                ('reset_delta', models.IntegerField()),
            ],
        ),
    ]
