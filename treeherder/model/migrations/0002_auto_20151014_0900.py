# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0001_initial'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='bugscache',
            options={'verbose_name_plural': 'bugscache'},
        ),
        migrations.AlterModelOptions(
            name='failurematch',
            options={'verbose_name_plural': 'failure matches'},
        ),
        migrations.AlterModelOptions(
            name='referencedatasignatures',
            options={'verbose_name_plural': 'reference data signatures'},
        ),
        migrations.AlterModelOptions(
            name='repository',
            options={'verbose_name_plural': 'repositories'},
        ),
        migrations.AlterField(
            model_name='classifiedfailure',
            name='failure_lines',
            field=models.ManyToManyField(related_name='classified_failures', through='model.FailureMatch', to='model.FailureLine'),
        ),
        migrations.AlterField(
            model_name='failurematch',
            name='failure_line',
            field=treeherder.model.fields.FlexibleForeignKey(related_name='matches', to='model.FailureLine'),
        ),
    ]
