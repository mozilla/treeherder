# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0023_simplify_machine_model'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='failureline',
            unique_together=set([]),
        ),
    ]
