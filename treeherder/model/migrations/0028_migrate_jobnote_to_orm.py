# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('model', '0027_move_bugjobmap_to_orm'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobNote',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('text', models.TextField()),
                ('timestamp', models.DateTimeField(auto_now_add=True)),
                ('failure_classification', models.ForeignKey(to='model.FailureClassification')),
                ('job', treeherder.model.fields.FlexibleForeignKey(to='model.Job')),
                ('user', models.ForeignKey(to=settings.AUTH_USER_MODEL, null=True)),
            ],
            options={
                'db_table': 'job_note',
            },
        ),
    ]
