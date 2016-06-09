# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('model', '0027_failure_line_idx_signature_test'),
    ]

    operations = [
        migrations.RunSQL(
            """
            DROP INDEX failure_line_test_idx ON failure_line;
            CREATE INDEX failure_line_test_idx ON failure_line (test(50), subtest(25), status, expected, created);
            DROP INDEX failure_line_signature_test_idx ON failure_line;
            CREATE INDEX failure_line_signature_test_idx ON failure_line (signature(25), test(50), created);
            """,
            """
            DROP INDEX failure_line_test_idx ON failure_line;
            CREATE INDEX failure_line_test_idx ON failure_line (test(50), subtest(25), status, expected);
            DROP INDEX failure_line_signature_idx ON failure_line;
            CREATE INDEX failure_line_signature_test_idx ON failure_line (signature(50), test);
            """,
            state_operations=[migrations.AlterIndexTogether(
                name='failureline',
                index_together=set([('test', 'subtest', 'status', 'expected', 'created'),
                                    ('job_guid', 'repository'),
                                    ('signature', 'test', 'created')])),])
    ]
