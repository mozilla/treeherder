# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0007_remove_datasource_oauth_fields'),
        ('perf', '0003_performancesignature_lower_is_better'),
    ]

    operations = [
        migrations.CreateModel(
            name='PerformanceAlert',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('is_regression', models.BooleanField()),
                ('status', models.IntegerField(default=0, choices=[(0, b'Untriaged'), (1, b'Downstream'), (2, b'Reassigned'), (3, b'Invalid'), (4, b'Acknowledged')])),
                ('amount_pct', models.FloatField(help_text=b'Amount in percentage that series has changed')),
                ('amount_abs', models.FloatField(help_text=b'Absolute amount that series has changed')),
                ('prev_value', models.FloatField(help_text=b'Previous value of series before change')),
                ('new_value', models.FloatField(help_text=b'New value of series after change')),
                ('t_value', models.FloatField(help_text=b"t value out of analysis indicating confidence that change is 'real'")),
            ],
            options={
                'db_table': 'performance_alert',
            },
        ),
        migrations.CreateModel(
            name='PerformanceAlertSummary',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('prev_result_set_id', models.PositiveIntegerField(null=True)),
                ('result_set_id', models.PositiveIntegerField()),
                ('last_updated', models.DateTimeField(db_index=True)),
                ('status', models.IntegerField(default=0, choices=[(0, b'Untriaged'), (1, b'Downstream'), (3, b'Invalid'), (4, b'Improvement'), (5, b'Investigating'), (6, b"Won't fix"), (7, b'Resolved')])),
                ('bug_number', models.PositiveIntegerField(null=True)),
                ('framework', models.ForeignKey(to='perf.PerformanceFramework', null=True)),
                ('repository', models.ForeignKey(to='model.Repository')),
            ],
            options={
                'db_table': 'performance_alert_summary',
            },
        ),
        migrations.AddField(
            model_name='performancealert',
            name='related_summary',
            field=models.ForeignKey(related_name='related_alerts', to='perf.PerformanceAlertSummary', null=True),
        ),
        migrations.AddField(
            model_name='performancealert',
            name='series_signature',
            field=models.ForeignKey(to='perf.PerformanceSignature'),
        ),
        migrations.AddField(
            model_name='performancealert',
            name='summary',
            field=models.ForeignKey(related_name='alerts', to='perf.PerformanceAlertSummary'),
        ),
        migrations.AlterUniqueTogether(
            name='performancealertsummary',
            unique_together=set([('repository', 'framework', 'prev_result_set_id', 'result_set_id')]),
        ),
        migrations.AlterUniqueTogether(
            name='performancealert',
            unique_together=set([('summary', 'series_signature')]),
        ),
    ]
