# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0021_add_jobdetail_model'),
    ]

    operations = [
        # Since Django doesn't natively support creating prefix indicies.
        migrations.RunSQL(
            ['CREATE INDEX failure_line_signature_idx ON failure_line (signature(50));'],
            reverse_sql=['DROP INDEX failure_line_signature_idx ON failure_line;'],
        ),
    ]
