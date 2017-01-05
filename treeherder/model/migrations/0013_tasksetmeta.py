# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0013_add_enable_perfalert_property_to_repository'),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskSetMeta',
            fields=[
                ('id', models.BigAutoField(serialize=False, primary_key=True)),
                ('count', models.IntegerField()),
                ('created', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'db_table': 'task_set_meta',
            },
        ),
    ]
