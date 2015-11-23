# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0004_add_runnable_job_table'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobDuration',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('signature', models.CharField(max_length=50L)),
                ('average_duration', models.PositiveIntegerField()),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'job_duration',
            },
        ),
        migrations.AlterUniqueTogether(
            name='jobduration',
            unique_together=set([('signature', 'repository')]),
        ),
    ]
