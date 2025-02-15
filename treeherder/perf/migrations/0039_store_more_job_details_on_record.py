# Generated by Django 3.1.6 on 2021-04-09 13:31

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('model', '0022_support_group_status'),
        ('perf', '0038_update_record_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='backfillrecord',
            name='job_group',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='backfill_records',
                to='model.jobgroup',
            ),
        ),
        migrations.AddField(
            model_name='backfillrecord',
            name='job_platform_option',
            field=models.CharField(max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='backfillrecord',
            name='job_tier',
            field=models.PositiveIntegerField(null=True),
        ),
    ]
