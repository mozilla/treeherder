# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0043_bugscache_cleanup'),
    ]

    operations = [
        migrations.CreateModel(
            name='TextLogErrorMatch',
            fields=[
                ('id', treeherder.model.fields.BigAutoField(serialize=False, primary_key=True)),
                ('score', models.DecimalField(null=True, max_digits=3, decimal_places=2, blank=True)),
                ('classified_failure', treeherder.model.fields.FlexibleForeignKey(related_name='error_matches', to='model.ClassifiedFailure')),
                ('matcher', models.ForeignKey(to='model.Matcher')),
            ],
            options={
                'db_table': 'text_log_error_match',
                'verbose_name_plural': 'text log error matches',
            },
        ),
        migrations.AddField(
            model_name='textlogerror',
            name='best_classification',
            field=treeherder.model.fields.FlexibleForeignKey(related_name='best_for_errors', on_delete=django.db.models.deletion.SET_NULL, to='model.ClassifiedFailure', null=True),
        ),
        migrations.AddField(
            model_name='textlogerror',
            name='best_is_verified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='textlogerror',
            name='failure_line',
            field=treeherder.model.fields.FlexibleOneToOneField(related_name='text_log_error', null=True, to='model.FailureLine'),
        ),
        migrations.AddField(
            model_name='textlogerrormatch',
            name='text_log_error',
            field=treeherder.model.fields.FlexibleForeignKey(related_name='matches', to='model.TextLogError'),
        ),
        migrations.AddField(
            model_name='classifiedfailure',
            name='text_log_errors',
            field=models.ManyToManyField(related_name='classified_failures', through='model.TextLogErrorMatch', to='model.TextLogError'),
        ),
        migrations.AlterUniqueTogether(
            name='textlogerrormatch',
            unique_together=set([('text_log_error', 'classified_failure', 'matcher')]),
        ),
    ]
