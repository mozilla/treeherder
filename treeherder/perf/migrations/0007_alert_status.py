# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0006_add_perfalerts_revised_summary'),
    ]

    operations = [
        migrations.AddField(
            model_name='performancealert',
            name='bug_number',
            field=models.PositiveIntegerField(null=True),
        ),
        migrations.AddField(
            model_name='performancealert',
            name='status',
            field=models.IntegerField(default=0, choices=[(0, b'Untriaged'), (1, b'Invalid'), (2, b"Won't fix"), (4, b'Resolved'), (3, b'Investigating'), (5, b'Duplicate')]),
        ),
    ]
