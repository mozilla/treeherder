from django.db import migrations

# group_status.id is a 32-bit integer and its sequence reached 2147483647, so
# every GroupStatus insert fails with "nextval: reached maximum value of
# sequence". Data cycling has deleted the low ids, so when the sequence is
# exhausted and the smallest remaining id leaves enough room below it, restart
# the sequence at 1 so inserts work again. The sequence is left alone on any
# database where that isn't true (fresh, staging, or already restarted).
#
# This is a stopgap: switching the column to bigint rewrites the whole table
# under an exclusive lock and needs to be scheduled separately.
INT_MAX = 2147483647
MIN_FREE_IDS = 500_000_000

RESTART_EXHAUSTED_SEQUENCE_SQL = f"""
DO $$
BEGIN
    IF (
        SELECT last_value FROM pg_sequences
        WHERE schemaname = current_schema() AND sequencename = 'group_status_id_seq'
    ) >= {INT_MAX}
    AND (SELECT MIN(id) FROM group_status) > {MIN_FREE_IDS} THEN
        ALTER SEQUENCE group_status_id_seq MINVALUE 1 RESTART WITH 1;
    END IF;
END
$$;
"""


class Migration(migrations.Migration):
    dependencies = [
        ("model", "0054_joblog_add_parse_attempts"),
    ]

    operations = [
        migrations.RunSQL(RESTART_EXHAUSTED_SEQUENCE_SQL, reverse_sql=migrations.RunSQL.noop),
    ]
