# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0037_remove_refdata_activestatus'),
    ]

    operations = [
        migrations.CreateModel(
            name='TextLogError',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('line', models.TextField()),
                ('line_number', models.PositiveIntegerField()),
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
                ('started', models.DateTimeField(null=True)),
                ('finished', models.DateTimeField(null=True)),
                ('started_line_number', models.PositiveIntegerField()),
                ('finished_line_number', models.PositiveIntegerField()),
                ('result', models.IntegerField(choices=[(0, 'success'), (1, 'testfailed'), (2, 'busted'), (3, 'skipped'), (4, 'exception'), (5, 'retry'), (6, 'usercancel'), (7, 'unknown')])),
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
            unique_together=set([('step', 'line_number')]),
        ),
    ]
