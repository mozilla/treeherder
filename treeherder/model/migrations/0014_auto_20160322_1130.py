# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0013_tasksetmeta'),
    ]

    operations = [
        migrations.CreateModel(
            name='TextLogSummary',
            fields=[
                ('id', models.BigAutoField(serialize=False, primary_key=True)),
                ('job_guid', models.CharField(max_length=50)),
                ('text_log_summary_artifact_id', models.PositiveIntegerField(null=True, blank=True)),
                ('bug_suggestions_artifact_id', models.PositiveIntegerField(null=True, blank=True)),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'text_log_summary',
            },
        ),
        migrations.CreateModel(
            name='TextLogSummaryLine',
            fields=[
                ('id', models.BigAutoField(serialize=False, primary_key=True)),
                ('line_number', models.PositiveIntegerField(null=True, blank=True)),
                ('bug_number', models.PositiveIntegerField(null=True, blank=True)),
                ('verified', models.BooleanField(default=False)),
                ('failure_line', models.ForeignKey(related_name='text_log_line', to='model.FailureLine', null=True)),
                ('summary', models.ForeignKey(related_name='lines', to='model.TextLogSummary')),
            ],
            options={
                'db_table': 'text_log_summary_line',
            },
        ),
        migrations.AlterUniqueTogether(
            name='textlogsummary',
            unique_together=set([('job_guid', 'repository')]),
        ),
    ]
