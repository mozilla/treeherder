# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0040_push_and_commit_orm_2'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobPriority',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('testtype', models.CharField(max_length=128)),
                ('buildtype', models.CharField(max_length=64)),
                ('platform', models.CharField(max_length=64)),
                ('priority', models.IntegerField()),
                ('timeout', models.IntegerField()),
                ('expiration_date', models.DateTimeField(null=True)),
                ('buildsystem', models.CharField(max_length=64)),
            ],
        ),
        migrations.CreateModel(
            name='TaskRequest',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('counter', models.IntegerField()),
                ('last_reset', models.DateTimeField()),
                ('reset_delta', models.IntegerField()),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
        ),
    ]
