# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0008__add_best_fields_to_failureline'),
    ]

    operations = [
        migrations.CreateModel(
            name='TextLogSummary',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
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
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('line_number', models.PositiveIntegerField(null=True, blank=True)),
                ('failure_line', treeherder.model.fields.FlexibleForeignKey(related_name='text_log_line', to='model.FailureLine', null=True)),
                ('summary', treeherder.model.fields.FlexibleForeignKey(related_name='lines', to='model.TextLogSummary')),
            ],
            options={
                'db_table': 'text_log_summary_line',
            },
        ),
    ]
