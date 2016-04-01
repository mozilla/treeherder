# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0012_performancesignature_parent_signature'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancesignature',
            name='has_subtests',
            field=models.BooleanField(default=False),
            preserve_default=False,
        ),
    ]
