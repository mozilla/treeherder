# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0039_push_and_commit_orm'),
        ('perf', '0020_remove_useless_perf_indexes'),
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
    ]
