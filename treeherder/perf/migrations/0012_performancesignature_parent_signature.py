# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0011_remove_null_fields_after_migration'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancesignature',
            name='parent_signature',
            field=models.ForeignKey(related_name='subtests', blank=True, to='perf.PerformanceSignature', null=True),
        ),
    ]
