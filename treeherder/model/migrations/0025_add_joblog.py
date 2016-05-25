# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0024_remove_failure_line_unique'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobLog',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=50)),
                ('url', models.URLField(max_length=255)),
                ('status', models.IntegerField(default=0, choices=[(0, 'pending'), (1, 'parsed'), (2, 'failed')])),
                ('job', treeherder.model.fields.FlexibleForeignKey(to='model.Job')),
            ],
            options={
                'db_table': 'job_log',
            },
        ),
        migrations.AlterUniqueTogether(
            name='joblog',
            unique_together=set([('job', 'name', 'url')]),
        ),
    ]
