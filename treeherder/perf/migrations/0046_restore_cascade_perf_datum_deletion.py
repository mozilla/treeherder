"""This migration is a copy of perf.0036_cascade_perf_datum_deletion
It restores the DB side CASCADE deletion behavior for perf_multicommitdatum table toward performance_datum
"""
from django.db import migrations
from django.conf import settings

MULTICOMMIT_CONSTRAINT_SYMBOL = 'perf_multicommitdatu_perf_datum_id_c2d7eb14_fk_performan'

if settings.DATABASES['default']['ENGINE'] == 'django.db.backends.mysql':
    DROP_TYPE = 'FOREIGN KEY'
else:
    DROP_TYPE = 'CONSTRAINT'


class Migration(migrations.Migration):
    dependencies = [
        ('perf', '0045_restore_perf_multicommitdatum_and_schema'),
    ]

    operations = [
        migrations.RunSQL(
            # add ON DELETE CASCADE at database level
            [
                f'ALTER TABLE perf_multicommitdatum '
                f'DROP {DROP_TYPE} {MULTICOMMIT_CONSTRAINT_SYMBOL};',
                f'ALTER TABLE perf_multicommitdatum '
                f'ADD CONSTRAINT {MULTICOMMIT_CONSTRAINT_SYMBOL} '
                f'FOREIGN KEY (perf_datum_id) REFERENCES performance_datum (ID) ON DELETE CASCADE;',
            ],
            # put back the non-CASCADE foreign key constraint
            reverse_sql=[
                f'ALTER TABLE perf_multicommitdatum '
                f'DROP {DROP_TYPE} {MULTICOMMIT_CONSTRAINT_SYMBOL};',
                f'ALTER TABLE perf_multicommitdatum '
                f'ADD CONSTRAINT {MULTICOMMIT_CONSTRAINT_SYMBOL} '
                f'FOREIGN KEY (perf_datum_id) REFERENCES performance_datum (ID);',
            ],
        )
    ]
