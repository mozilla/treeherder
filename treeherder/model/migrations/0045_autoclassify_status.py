# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0044_duplicate_failure_classifications'),
    ]

    operations = [
        migrations.AddField(
            model_name='job',
            name='autoclassify_status',
            field=models.IntegerField(default=0, choices=[(0, 'pending'), (1, 'crossreferenced'), (2, 'autoclassified'), (3, 'skipped'), (255, 'failed')]),
        ),
    ]
