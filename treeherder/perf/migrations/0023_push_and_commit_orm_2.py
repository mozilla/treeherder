# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0022_alert_summary_push_uniqueness'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancealertsummary',
            name='prev_push',
            field=models.ForeignKey(related_name='+', to='model.Push'),
        ),
        migrations.AlterField(
            model_name='performancealertsummary',
            name='push',
            field=models.ForeignKey(related_name='+', to='model.Push'),
        ),
        migrations.AlterField(
            model_name='performancealertsummary',
            name='result_set_id',
            field=models.PositiveIntegerField(null=True),
        ),
        migrations.AlterField(
            model_name='performancedatum',
            name='push',
            field=models.ForeignKey(to='model.Push'),
        ),
        migrations.AlterField(
            model_name='performancedatum',
            name='result_set_id',
            field=models.PositiveIntegerField(null=True),
        ),
        migrations.AlterUniqueTogether(
            name='performancealertsummary',
            unique_together=set([('repository', 'framework', 'prev_push', 'push')]),
        ),
        migrations.AlterUniqueTogether(
            name='performancedatum',
            unique_together=set([('repository', 'job_id', 'result_set_id', 'signature', 'push_timestamp'), ('repository', 'job_id', 'push', 'signature')]),
        ),
        migrations.AlterIndexTogether(
            name='performancedatum',
            index_together=set([('repository', 'signature', 'push_timestamp'), ('repository', 'job_id')]),
        ),
    ]
