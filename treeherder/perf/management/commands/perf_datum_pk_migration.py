"""IMPORTANT!
This subcommand isn't intended for regular use.
Its purpose is to fill up performance_datum new table with bigint primary keys.
It should be runned after migration perf.0043_perf_datum_bigint_table
and before migration perf.0044_perf_datum_table_swap
"""
import logging
from django.db import connection
from django.core.management.base import BaseCommand, CommandError

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Fill performance_datum_copy table with rows populating the actual performance_datum'

    def add_arguments(self, parser):
        "Insert data from the existing table using successive INSERT INTO … SELECT FROM …"
        parser.add_argument(
            '--chunk-size',
            default=100000,
            type=int,
            help='How many rows to update at a time',
        )

    def get_max_id(self, table_name, pk="id"):
        with connection.cursor() as cursor:
            cursor.execute(f'SELECT MAX({pk}) FROM {table_name}')
            (max_id,) = cursor.fetchone()
            return max_id

    def copy_data(self, from_table, to_table, pk):
        logger.info(f"Copying data from {from_table} to {to_table}")
        from_max_id = self.get_max_id(from_table, pk) or 0
        to_max_id = self.get_max_id(to_table, pk) or 0

        if from_max_id == to_max_id:
            logger.info(f'Nothing to do, both tables are sync at ID {from_max_id}')
            return

        # Create chunk tuples composed of a start ID and end ID over the range of entries to copy
        chunks = [
            (i, i + min(self.chunk_size, from_max_id))
            for i in range(to_max_id, from_max_id, self.chunk_size)
        ]

        chunks_count = len(chunks)
        logger.info(
            f'Inserting {from_max_id - to_max_id} entries to the new table in {chunks_count} chunks'
        )

        for index, (min_id, max_id) in enumerate(chunks, start=1):
            logger.info(f'Inserting data for chunk {index} / {chunks_count}')
            with connection.cursor() as cursor:
                cursor.execute(
                    (
                        f'INSERT INTO {to_table} SELECT * FROM {from_table} '
                        f'WHERE `{from_table}`.`{pk}` > %s '
                        f'AND `{from_table}`.`{pk}` <= %s'
                    ),
                    [min_id, max_id],
                )

    def handle(self, *args, chunk_size=None, **options):
        self.chunk_size = chunk_size
        if not isinstance(self.chunk_size, int):
            raise CommandError("chunk_size parameter should be an integer")

        self.copy_data(
            from_table="perf_multicommitdatum",
            to_table="perf_multicommitdatum_new",
            pk="perf_datum_id",
        )
        self.copy_data(from_table="performance_datum", to_table="performance_datum_new", pk="id")
