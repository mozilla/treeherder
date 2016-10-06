# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0020_push_and_commit_orm'),
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
    ]
