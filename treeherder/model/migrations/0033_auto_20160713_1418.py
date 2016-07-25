# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0032_bugjobmap_jobnote_models'),
    ]

    operations = [
        migrations.CreateModel(
            name='TextLogError',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('line', models.CharField(max_length=1024)),
                ('line_number', models.PositiveIntegerField()),
                ('bug_number', models.PositiveIntegerField(null=True, blank=True)),
                ('verified', models.BooleanField(default=False)),
                ('failure_line', treeherder.model.fields.FlexibleForeignKey(related_name='job_log_step_error', to='model.FailureLine', null=True)),
                ('job', treeherder.model.fields.FlexibleForeignKey(to='model.Job')),
            ],
            options={
                'db_table': 'text_log_error',
            },
        ),
        migrations.CreateModel(
            name='TextLogStep',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=200)),
                ('started', models.DateTimeField()),
                ('finished', models.DateTimeField()),
                ('started_line_number', models.PositiveIntegerField()),
                ('finished_line_number', models.PositiveIntegerField()),
                ('result', models.IntegerField(choices=[(0, 'success'), (3, 'skipped'), (1, 'testfailed')])),
                ('job', treeherder.model.fields.FlexibleForeignKey(to='model.Job')),
            ],
            options={
                'db_table': 'text_log_step',
            },
        ),
        migrations.AddField(
            model_name='textlogerror',
            name='step',
            field=treeherder.model.fields.FlexibleForeignKey(related_name='errors', to='model.TextLogStep'),
        ),
        migrations.AlterUniqueTogether(
            name='textlogstep',
            unique_together=set([('job', 'started_line_number', 'finished_line_number')]),
        ),
        migrations.AlterUniqueTogether(
            name='textlogerror',
            unique_together=set([('job', 'line_number')]),
        ),
    ]
