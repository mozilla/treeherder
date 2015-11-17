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
                ('is_regression', models.BooleanField()),
                ('amount_pct', models.FloatField()),
                ('amount_abs', models.FloatField()),
                ('prev_value', models.FloatField()),
                ('new_value', models.FloatField()),
                ('t_value', models.FloatField()),
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
                ('prev_result_set_id', models.PositiveIntegerField()),
                ('result_set_id', models.PositiveIntegerField()),
                ('last_updated', models.DateTimeField(db_index=True)),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'performance_alert_summary',
            },
        ),
        migrations.AddField(
            model_name='performancealert',
            name='summary',
            field=models.ForeignKey(to='perf.PerformanceAlertSummary'),
        ),
        migrations.AlterUniqueTogether(
            name='performancealertsummary',
            unique_together=set([('repository', 'prev_result_set_id', 'result_set_id')]),
        ),
        migrations.AlterUniqueTogether(
            name='performancealert',
            unique_together=set([('summary', 'series_signature')]),
        ),
    ]
