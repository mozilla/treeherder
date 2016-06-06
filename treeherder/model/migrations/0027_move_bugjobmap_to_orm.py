# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('model', '0026_failure_line_job_log_id'),
    ]

    operations = [
        migrations.CreateModel(
            name='BugJobMap',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('bug_id', models.PositiveIntegerField(db_index=True)),
                ('submit_timestamp', models.DateTimeField(auto_now_add=True)),
                ('job', treeherder.model.fields.FlexibleForeignKey(to='model.Job')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True)),
            ],
            options={
                'db_table': 'bug_job_map',
            },
        ),
        migrations.AlterUniqueTogether(
            name='bugjobmap',
            unique_together=set([('job', 'bug_id')]),
        ),
    ]
