# Generated by Django 2.1.7 on 2019-04-03 11:41

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('perf', '0013_add_alert_timestamps'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancedatum',
            name='push_timestamp',
            field=models.DateTimeField(db_index=True),
        ),
    ]
