import time

from django.core.management.base import BaseCommand

from treeherder.model.models import FailureLine
from treeherder.services.elasticsearch import (bulk,
                                               count_index,
                                               es_conn,
                                               reinit_index)
from treeherder.services.elasticsearch.mapping import INDEX_NAME
from treeherder.utils.queryset import chunked_qs


class Command(BaseCommand):
    help = """
        Populate ElasticSearch with data from the DB failure_line table.

        This script must be run when ElasticSearch is first set up, to ensure that
        existing data is considered for matching failure lines.
    """

    def add_arguments(self, parser):
        parser.add_argument(
            '--recreate',
            action='store_true',
            help="Delete and recreate index"
        )
        parser.add_argument(
            '--chunk-size',
            action='store',
            type=int,
            default=10000,
            help='Chunk size to use for select/insert'
        )
        parser.add_argument(
            '--sleep',
            action='store',
            type=int,
            default=1,
            help='Seconds to sleep between batches'
        )

    def handle(self, *args, **options):
        if options['recreate']:
            reinit_index()
        elif INDEX_NAME in es_conn.send_request('GET', '*').keys():
            # get the index name from the all indicies listing
            self.stderr.write("Index already exists; can't perform import")
            return

        fields = [
            'id',
            'action',
            'job_guid',
            'test',
            'subtest',
            'status',
            'expected',
            'message',
            'best_classification_id',
            'best_is_verified',
        ]

        failure_lines = FailureLine.objects.filter(action='test_result')
        for rows in chunked_qs(failure_lines, options['chunk_size'], fields=fields):
            inserted = bulk(rows)
            msg = 'Inserted {} documents from {} FailureLines'
            self.stdout.write(msg.format(inserted, len(rows)))

            time.sleep(options['sleep'])

        count = count_index()
        self.stdout.write('Index contains {} documents'.format(count))
