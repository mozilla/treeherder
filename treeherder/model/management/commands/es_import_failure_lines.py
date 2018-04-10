import time

from django.core.management.base import BaseCommand
from elasticsearch_dsl import Search

from treeherder.model.models import FailureLine
from treeherder.model.search import (TestFailureLine,
                                     bulk_insert,
                                     connection)
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
        if options["recreate"]:
            connection.indices.delete(TestFailureLine._doc_type.index, ignore=404)
            TestFailureLine.init()
        elif connection.indices.exists(TestFailureLine._doc_type.index):
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
            if not rows:
                break

            es_lines = [TestFailureLine.from_model(line) for line in rows]
            self.stdout.write("Inserting %i rows" % len(es_lines))
            bulk_insert(es_lines)

            time.sleep(options['sleep'])

        count = Search(doc_type=TestFailureLine).count()
        self.stdout.write("Index contains %i documents" % count)
