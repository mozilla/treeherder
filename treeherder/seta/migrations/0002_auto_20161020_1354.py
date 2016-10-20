# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0038_text_log_db'),
        ('seta', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskRequest',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('counter', models.IntegerField()),
                ('last_request', models.DateTimeField()),
                ('reset_delta', models.IntegerField()),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
        ),
        migrations.RenameModel(
            old_name='JobPriorities',
            new_name='JobPriority',
        ),
        migrations.DeleteModel(
            name='TaskRequests',
        ),
    ]
