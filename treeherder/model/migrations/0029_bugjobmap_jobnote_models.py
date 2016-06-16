# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
from django.conf import settings
import django.utils.timezone
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('model', '0028_test_match_created_index'),
    ]

    operations = [
        migrations.CreateModel(
            name='BugJobMap',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('bug_id', models.PositiveIntegerField(db_index=True)),
                ('created', models.DateTimeField(default=django.utils.timezone.now)),
                ('job', treeherder.model.fields.FlexibleForeignKey(to='model.Job')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True)),
            ],
            options={
                'db_table': 'bug_job_map',
            },
        ),
        migrations.CreateModel(
            name='JobNote',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('text', models.TextField()),
                ('created', models.DateTimeField(default=django.utils.timezone.now)),
                ('failure_classification', models.ForeignKey(to='model.FailureClassification')),
                ('job', treeherder.model.fields.FlexibleForeignKey(to='model.Job')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True)),
            ],
            options={
                'db_table': 'job_note',
            },
        ),
        migrations.AlterUniqueTogether(
            name='bugjobmap',
            unique_together=set([('job', 'bug_id')]),
        ),
    ]
