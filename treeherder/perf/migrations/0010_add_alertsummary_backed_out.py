# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('perf', '0009_refactor_perfalerts'),
    ]

    operations = [
        migrations.AlterField(
            model_name='performancealertsummary',
            name='status',
            field=models.IntegerField(default=0, choices=[(0, b'Untriaged'), (1, b'Downstream'), (3, b'Invalid'), (4, b'Improvement'), (5, b'Investigating'), (6, b"Won't fix"), (7, b'Fixed'), (8, b'Backed out')]),
        ),
    ]
