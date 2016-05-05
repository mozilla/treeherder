# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0020_update_job_name_length'),
    ]

    operations = [
        migrations.RunSQL(
            """CREATE INDEX failure_line_signature_idx ON failure_line
            (signature(50));""",
            """DROP INDEX failure_line_signature_idx ON failure_line;"""),
    ]
