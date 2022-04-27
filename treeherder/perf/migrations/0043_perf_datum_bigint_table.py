from django.db import migrations


class Migration(migrations.Migration):
    """Creates a copy of the current performance_datum table
    The primary key is updated from INT(11) to BIGINT(20) corresponding to BigAutoField
    This migration is a preliminary work to https://bugzilla.mozilla.org/show_bug.cgi?id=1343328
    """

    dependencies = [
        ('perf', '0042_backfillrecord_new_fields'),
    ]

    operations = [
        migrations.RunSQL(
            [
                # Copy performance_datum table structure
                'CREATE TABLE performance_datum_new LIKE performance_datum',
                # Update the PK to bigint
                'ALTER TABLE performance_datum_new CHANGE id id BIGINT(20) AUTO_INCREMENT',
            ],
            reverse_sql='DROP TABLE IF EXISTS performance_datum_new',
            elidable=False,
        )
    ]
