# Generated by Django 3.0.8 on 2020-10-14 07:47

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('perf', '0033_permit_multi_data_per_job'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='performancedatum',
            name='ds_job_id',
        ),
        migrations.RemoveField(
            model_name='performancedatum',
            name='result_set_id',
        ),
    ]
