# -*- coding: utf-8 -*-
from __future__ import print_function

import collections
import logging
import sys

from treeherder.model.models import FailureLine
from treeherder.services.elasticsearch import (bulk,
                                               refresh_index,
                                               reinit_index,
                                               search)
from treeherder.utils.logs import suppress_logs

logger = logging.getLogger(__name__)

failure_lines = (FailureLine.objects.exclude(message=None)
                                    .exclude(message=''))


def print_row(label, value):
    """
    A method to print a row for a horizontal graphs.
    i.e:
        1: ▇▇ 2
        2: ▇▇▇ 3
        3: ▇▇▇▇ 4
    """
    TICK = '▇'
    SM_TICK = '▏'

    # Label
    print('{}: '.format(label), end="")

    # One block for each value
    for i in range(value):
        sys.stdout.write(TICK)
    else:
        # Print something if it's not the smallest
        # and the normal value is less than one.
        sys.stdout.write(SM_TICK)

    # Tail
    print(value)


def run():
    with suppress_logs('elasticsearch.trace'):
        reinit_index()

        count = bulk(failure_lines)
        print('Inserted {} documents from {} FailureLines'.format(count, len(failure_lines)))

        refresh_index()

        counter = collections.Counter()
        for failure_line in failure_lines:
            query = {
                'query': {
                    'match_phrase': {
                        'message': failure_line.message,
                    },
                },
            }
            results = search(query)

            counter[len(results)] += 1

        for row in counter.items():
            print_row(*row)

    # Iterate over the lines trying to find themselves/close to themselves


if __name__ == '__main__':
    run()
