# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0014_auto_20160322_1130'),
    ]

    operations = [
        migrations.RunSQL(
            """CREATE INDEX failure_line_test_idx ON failure_line
            (test(50), subtest(25), status, expected);""",
            """DROP INDEX failure_line_test_idx ON failure_line;""",
            state_operations=[migrations.AlterIndexTogether(
                name='failureline',
                index_together=set([('job_guid', 'repository'),
                                    ('test', 'subtest', 'status', 'expected')]),
            )],
        )
    ]
