from django.db import migrations


class Migration(migrations.Migration):
    """Creates a copy of the current performance_datum table
    The primary key is updated from INT(11) to BIGINT(20) corresponding to BigAutoField
    perf_multicommitdatum temporarily flag a performance datum element
    """

    dependencies = [
        ('perf', '0042_backfillrecord_new_fields'),
    ]

    operations = [
        migrations.RunSQL(
            [
                # Copy performance_datum table structure with no index nor constraint
                # ID column is updated to store a bigint, PK index and AUTO_INCREMENT will be added later on
                (
                    'CREATE TABLE `performance_datum_new` ('
                    '    `id` bigint(20) NOT NULL,'
                    '    `value` double NOT NULL,'
                    '    `push_timestamp` datetime(6) NOT NULL,'
                    '    `job_id` bigint(20) DEFAULT NULL,'
                    '    `push_id` int(11) NOT NULL,'
                    '    `repository_id` int(11) NOT NULL,'
                    '    `signature_id` int(11) NOT NULL'
                    ')'
                ),
                # Copy perf_multicommitdatum table as it has a FK to performance_datum
                'CREATE TABLE `perf_multicommitdatum_new` (`perf_datum_id` bigint(20) NOT NULL)',
            ],
            reverse_sql=[
                'DROP TABLE IF EXISTS performance_datum_new',
                'DROP TABLE IF EXISTS perf_multicommitdatum_new',
            ],
            elidable=False,
        )
    ]
