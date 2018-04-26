import subprocess

from django.core.management.base import BaseCommand

from treeherder.model.models import FailureLine
from treeherder.services.elasticsearch import (count_index,
                                               index,
                                               reinit_index,
                                               search)
from treeherder.utils.logs import suppress_logs


class Command(BaseCommand):
    def analyze_text(self, text):
        cmd = 'elyzer --index failure-lines --analyzer message_analyzer "{}"'
        subprocess.check_call(cmd.format(text), shell=True)

    def handle(self, *args, **options):
        # FailureLine with a JS stack trace
        failure_line = FailureLine.objects.get(id='109651324')

        with suppress_logs('elasticsearch.trace'):
            self.index_data(failure_line)

        self.analyze_text(failure_line.message)

        with suppress_logs('elasticsearch.trace'):
            self.test_search(failure_line)

    def index_data(self, failure_line):
        reinit_index()
        index(failure_line)
        print('Index currently has {} docs'.format(count_index()))

    def test_search(self, failure_line):
        filters = [
            # {'term': {'test': failure_line.test}},
            # {'term': {'status': failure_line.status}},
            # {'term': {'expected': failure_line.expected}},
            # {'exists': {'field': 'best_classification'}}
        ]
        # if failure_line.subtest:
        #     query = filters.append({'term': {'subtest': failure_line.subtest}})

        query = {
            'explain': True,
            'query': {
                'bool': {
                    'filter': filters,
                    'must': [{
                        'match': {
                            'message': {
                                'query': failure_line.message[:1024],
                                'type': 'phrase'
                            },
                        },
                    }],
                },
            },
        }
        query = {
            'query': {
                'match': {
                    'message': {
                        'query': failure_line.message[:1024],
                        'type': 'phrase'
                    },
                },
            },
        }

        results = search(query)
        print('Got {} results'.format(len(results)))
