# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0026_failure_line_job_log_id'),
    ]

    operations = [
        migrations.RunSQL(
            """CREATE INDEX failure_line_signature_test_idx ON failure_line
            (signature(50), test(50));""",
            """DROP INDEX failure_line_signature_test_idx ON failure_line;""",
            state_operations=[migrations.AlterIndexTogether(
                name='failureline',
                index_together=set([('signature', 'test'),
                                    ('job_guid', 'repository'),
                                    ('test', 'subtest', 'status', 'expected')]))],
        ),
    ]
