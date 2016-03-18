# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0008__add_best_fields_to_failureline'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='referencedatasignatures',
            name='review_status',
        ),
        migrations.RemoveField(
            model_name='referencedatasignatures',
            name='review_timestamp',
        ),
    ]
