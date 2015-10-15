# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0002_auto_20151014_0900'),
        ('perf', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancesignature',
            name='last_updated',
            field=models.DateTimeField(null=True, db_index=True),
        ),
        migrations.AddField(
            model_name='performancesignature',
            name='repository',
            field=models.ForeignKey(to='model.Repository', null=True),
        ),
        migrations.AlterField(
            model_name='performancesignature',
            name='signature_hash',
            field=models.CharField(db_index=True, max_length=40L, validators=[django.core.validators.MinLengthValidator(40L)]),
        ),
        migrations.AlterUniqueTogether(
            name='performancesignature',
            unique_together=set([('repository', 'signature_hash')]),
        ),
    ]
