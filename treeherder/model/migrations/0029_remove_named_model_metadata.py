# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0028_test_match_created_index'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='failureclassification',
            name='active_status',
        ),
        migrations.RemoveField(
            model_name='failureclassification',
            name='description',
        ),
        migrations.RemoveField(
            model_name='option',
            name='active_status',
        ),
        migrations.RemoveField(
            model_name='option',
            name='description',
        ),
        migrations.RemoveField(
            model_name='product',
            name='active_status',
        ),
        migrations.RemoveField(
            model_name='product',
            name='description',
        ),
        migrations.RemoveField(
            model_name='repositorygroup',
            name='active_status',
        ),
        migrations.RemoveField(
            model_name='repositorygroup',
            name='description',
        ),
        migrations.AlterField(
            model_name='failureclassification',
            name='name',
            field=models.CharField(unique=True, max_length=50),
        ),
        migrations.AlterField(
            model_name='option',
            name='name',
            field=models.CharField(unique=True, max_length=50),
        ),
        migrations.AlterField(
            model_name='product',
            name='name',
            field=models.CharField(unique=True, max_length=50),
        ),
        migrations.AlterField(
            model_name='repositorygroup',
            name='name',
            field=models.CharField(unique=True, max_length=50),
        ),
    ]
