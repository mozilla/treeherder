# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models
import django.db.models.deletion
import treeherder.model.fields


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0046_remove_flat_exclusion_column'),
        ('perf', '0026_drop_alertsummary_rsid'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancedatum',
            name='job',
            field=treeherder.model.fields.FlexibleForeignKey(on_delete=django.db.models.deletion.SET_NULL, default=None, to='model.Job', null=True),
        ),
    ]
