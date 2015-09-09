# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='PerformanceDatum',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('job_id', models.PositiveIntegerField(db_index=True)),
                ('result_set_id', models.PositiveIntegerField(db_index=True)),
                ('value', models.FloatField()),
                ('push_timestamp', models.DateTimeField(db_index=True)),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'performance_datum',
            },
        ),
        migrations.CreateModel(
            name='PerformanceFramework',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.SlugField(unique=True, max_length=255L)),
            ],
            options={
                'db_table': 'performance_framework',
            },
        ),
        migrations.CreateModel(
            name='PerformanceSignature',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('signature_hash', models.CharField(db_index=True, unique=True, max_length=40L, validators=[django.core.validators.MinLengthValidator(40L)])),
                ('suite', models.CharField(max_length=80L)),
                ('test', models.CharField(max_length=80L, blank=True)),
                ('extra_properties', jsonfield.fields.JSONField(max_length=1024)),
                ('framework', models.ForeignKey(to='perf.PerformanceFramework')),
                ('option_collection', models.ForeignKey(to='model.OptionCollection')),
                ('platform', models.ForeignKey(to='model.MachinePlatform')),
            ],
            options={
                'db_table': 'performance_signature',
            },
        ),
        migrations.AddField(
            model_name='performancedatum',
            name='signature',
            field=models.ForeignKey(to='perf.PerformanceSignature'),
        ),
        migrations.AlterUniqueTogether(
            name='performancedatum',
            unique_together=set([('repository', 'job_id', 'result_set_id', 'signature', 'push_timestamp')]),
        ),
        migrations.AlterIndexTogether(
            name='performancedatum',
            index_together=set([('repository', 'result_set_id'), ('repository', 'signature', 'push_timestamp'), ('repository', 'job_id')]),
        ),
    ]
