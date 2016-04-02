# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0013_add_enable_perfalert_property_to_repository'),
    ]

    operations = [
        migrations.CreateModel(
            name='PulseStore',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('revision', models.CharField(max_length=40, db_index=True)),
                ('message', models.TextField()),
                ('created', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'pulse_store',
            },
        ),
        migrations.AlterField(
            model_name='jobgroup',
            name='name',
            field=models.CharField(max_length=100, db_index=True),
        ),
        migrations.AlterField(
            model_name='jobtype',
            name='name',
            field=models.CharField(max_length=100, db_index=True),
        ),
    ]
