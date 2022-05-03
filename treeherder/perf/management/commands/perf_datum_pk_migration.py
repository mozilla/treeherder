"""IMPORTANT!
This subcommand isn't intended for regular use.
Its purpose is to fill up performance_datum new table with bigint primary keys.
It should be runned after migration perf.0043_perf_datum_bigint_table
and before migration perf.0044_perf_datum_table_swap
"""
import logging
from django.db import connection
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

TABLE_NAME = 'performance_datum'
NEW_TABLE = 'performance_datum_new'


def get_max_id(table_name):
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT MAX(id) FROM {table_name}')
        (max_id,) = cursor.fetchone()
        return max_id


class Command(BaseCommand):
    help = 'Fill performance_datum_copy table with rows populating the actual performance_datum'

    def add_arguments(self, parser):
        """
        Insert data from the existing table using successive INSERT INTO … SELECT FROM …
        MySQL struggles with INSERT on large tables, as indexes no longer fits in memory
        A solution to this would be to drop indexes and restore them after copying all the data
        """
        parser.add_argument(
            '--chunk-size',
            default=100000,
            type=int,
            help='How many rows to update at a time',
        )

    def handle(self, *args, chunk_size=None, **options):

        table_max_id = get_max_id(TABLE_NAME)
        new_table_max_id = get_max_id(NEW_TABLE) or 0

        if not table_max_id:
            raise Exception(f'No entry found on table {TABLE_NAME}')

        if table_max_id == new_table_max_id:
            logger.info(f'Nothing to do, both tables are sync at ID {table_max_id}')
            return

        # Create chunk tuples composed of a start ID and end ID over the range of entries to copy
        chunks = [
            (i, i + min(chunk_size, table_max_id))
            for i in range(new_table_max_id, table_max_id, chunk_size)
        ]

        chunks_count = len(chunks)
        logger.info(
            f'Inserting {table_max_id - new_table_max_id} entries to the new table in {chunks_count} chunks'
        )

        for index, (min_id, max_id) in enumerate(chunks, start=1):
            logger.info(f'Inserting data for chunk {index} / {chunks_count}')
            with connection.cursor() as cursor:
                cursor.execute(
                    (
                        f'INSERT INTO {NEW_TABLE} SELECT * FROM {TABLE_NAME} '
                        f'WHERE `{TABLE_NAME}`.`id` > %s '
                        f'AND `{TABLE_NAME}`.`id` <= %s'
                    ),
                    [min_id, max_id],
                )
