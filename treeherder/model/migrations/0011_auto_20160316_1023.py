# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import (migrations,
                       models)
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0010_machine_name_unique'),
    ]

    operations = [
        migrations.AlterField(
            model_name='failureline',
            name='best_classification',
            field=models.ForeignKey(related_name='best_for_lines', on_delete=django.db.models.deletion.SET_NULL, to='model.ClassifiedFailure', null=True),
        ),
    ]
