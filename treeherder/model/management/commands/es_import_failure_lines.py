import time
from optparse import make_option

from django.core.management.base import BaseCommand
from elasticsearch_dsl import Search

from treeherder.model.models import FailureLine
from treeherder.model.search import (TestFailureLine,
                                     bulk_insert)


class Command(BaseCommand):

    help = "Pre-populate reference data from an external source (INCOMPLETE)"
    option_list = BaseCommand.option_list + (
        make_option('--chunk-size',
                    action='store',
                    type='int',
                    default=10000,
                    help='Chunk size to use for select/insert'),
        make_option('--sleep',
                    action='store',
                    type='int',
                    default=1,
                    help='Seconds to sleep between batches'),
        )

    def handle(self, *args, **options):
        min_id = FailureLine.objects.order_by('id').values_list("id", flat=True)[0] - 1
        print options
        chunk_size = options['chunk_size']

        while True:
            rows = (FailureLine.objects
                    .filter(id__gt=min_id)
                    .order_by('id')
                    .values("id", "job_guid", "action", "test", "subtest",
                            "status", "expected", "message", "best_classification_id",
                            "best_is_verified"))[:chunk_size]
            if not rows:
                break
            es_lines = []
            for item in rows:
                es_line = failure_line_from_value(item)
                if es_line:
                    es_lines.append(es_line)
            print "Inserting %i rows" % len(es_lines)
            bulk_insert(es_lines)
            min_id = rows[len(rows) - 1]["id"]
            time.sleep(options['sleep'])
        s = Search(doc_type=TestFailureLine).params(search_type="count")
        print "Index contains %i documents" % s.execute().hits.total


def failure_line_from_value(line):
    if line["action"] == "test_result":
        rv = TestFailureLine(job_guid=line["job_guid"],
                             test=line["test"],
                             subtest=line["subtest"],
                             status=line["status"],
                             expected=line["expected"],
                             message=line["message"],
                             best_classification=line["best_classification_id"],
                             best_is_verified=line["best_is_verified"])
        rv.meta.id = line["id"]
        return rv
