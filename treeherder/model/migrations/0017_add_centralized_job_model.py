# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0016_enforce repository name uniqueness'),
    ]

    operations = [
        migrations.CreateModel(
            name='Job',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('guid', models.CharField(unique=True, max_length=50, db_index=True)),
                ('project_specific_id', models.PositiveIntegerField(db_index=True)),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'job',
            },
        ),
        migrations.AlterUniqueTogether(
            name='job',
            unique_together=set([('repository', 'project_specific_id')]),
        ),
    ]
