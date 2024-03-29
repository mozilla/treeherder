# Generated by Django 3.0.5 on 2020-04-22 00:00

import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('model', '0016_add_index_commit_revision'),
    ]

    operations = [
        migrations.AlterField(
            model_name='taskclustermetadata',
            name='task_id',
            field=models.CharField(
                db_index=True,
                max_length=22,
                validators=[django.core.validators.MinLengthValidator(22)],
            ),
        ),
    ]
