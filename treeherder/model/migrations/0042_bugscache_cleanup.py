# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0041_job_metadata'),
    ]

    operations = [
        migrations.AlterField(
            model_name='bugscache',
            name='id',
            field=models.PositiveIntegerField(serialize=False, primary_key=True),
        ),
        migrations.AlterField(
            model_name='bugscache',
            name='modified',
            field=models.DateTimeField(),
        ),
        migrations.AlterField(
            model_name='bugscache',
            name='status',
            field=models.CharField(max_length=64, db_index=True),
        ),

        # These fulltext indexes were added via RunSQL commands in 0001_initial, but are not used.
        migrations.RunSQL(
            sql='ALTER TABLE bugscache DROP INDEX idx_crash_signature',
            reverse_sql='CREATE FULLTEXT INDEX `idx_crash_signature` on bugscache (`crash_signature`);',
        ),
        migrations.RunSQL(
            sql='ALTER TABLE bugscache DROP INDEX idx_keywords',
            reverse_sql='CREATE FULLTEXT INDEX `idx_keywords` on bugscache (`keywords`);',
        ),
        migrations.RunSQL(
            sql='ALTER TABLE bugscache DROP INDEX idx_all_full_text',
            reverse_sql='CREATE FULLTEXT INDEX `idx_all_full_text` on bugscache (`summary`, `crash_signature`, `keywords`);',
        ),
    ]
