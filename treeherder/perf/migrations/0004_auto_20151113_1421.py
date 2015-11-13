# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0003_auto_20151111_0942'),
        ('perf', '0003_performancesignature_lower_is_better'),
    ]

    operations = [
        migrations.CreateModel(
            name='PerformanceAlert',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('prev_result_set_id', models.PositiveIntegerField()),
                ('result_set_id', models.PositiveIntegerField()),
                ('is_regression', models.BooleanField()),
                ('amount_pct', models.FloatField()),
                ('amount_abs', models.FloatField()),
                ('prev_value', models.FloatField()),
                ('new_value', models.FloatField()),
                ('t_value', models.FloatField()),
                ('repository', models.ForeignKey(to='model.Repository')),
                ('series_signature', models.ForeignKey(to='perf.PerformanceSignature')),
            ],
            options={
                'db_table': 'performance_alert',
            },
        ),
        migrations.CreateModel(
            name='PerformanceAlertSummary',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('status', models.IntegerField(default=0, choices=[(0, b'New'), (1, b"Won't fix"), (2, b'Backed out'), (3, b'Invalid'), (4, b'Bug filed'), (5, b'Duplicate')])),
                ('prev_result_set_id', models.PositiveIntegerField()),
                ('result_set_id', models.PositiveIntegerField()),
                ('bugzilla_id', models.PositiveIntegerField(null=True)),
                ('last_updated', models.DateTimeField(db_index=True)),
                ('generated_alerts', models.ManyToManyField(related_name='generated_alerts', to='perf.PerformanceAlert')),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'performance_alert_summary',
            },
        ),
        migrations.AlterUniqueTogether(
            name='performancealertsummary',
            unique_together=set([('repository', 'prev_result_set_id', 'result_set_id')]),
        ),
        migrations.AlterUniqueTogether(
            name='performancealert',
            unique_together=set([('repository', 'prev_result_set_id', 'result_set_id', 'series_signature')]),
        ),
    ]
