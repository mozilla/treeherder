# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0039_push_and_commit_orm'),
        ('perf', '0019_performancealert_classifier'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancealertsummary',
            name='prev_push',
            field=models.ForeignKey(related_name='+', to='model.Push', null=True),
        ),
        migrations.AddField(
            model_name='performancealertsummary',
            name='push',
            field=models.ForeignKey(related_name='+', to='model.Push', null=True),
        ),
        migrations.AddField(
            model_name='performancedatum',
            name='push',
            field=models.ForeignKey(to='model.Push', null=True),
        ),
        migrations.AlterUniqueTogether(
            name='performancealertsummary',
            unique_together=set([('framework', 'prev_push', 'push'), ('repository', 'framework', 'prev_result_set_id', 'result_set_id')]),
        ),
        migrations.AlterUniqueTogether(
            name='performancedatum',
            unique_together=set([('repository', 'job_id', 'result_set_id', 'signature'), ('repository', 'job_id', 'push', 'signature')]),
        ),
        migrations.AlterIndexTogether(
            name='performancealertsummary',
            index_together=set([('repository', 'result_set_id'), ('repository', 'prev_result_set_id')]),
        ),
    ]
