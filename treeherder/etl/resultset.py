import logging
from datetime import datetime

from django.db import transaction

from treeherder.model.models import (Commit,
                                     Push)

logger = logging.getLogger(__name__)


def _store_push(repository, result_set):
    result_set_revision = result_set.get('revision')
    if not result_set.get('revision'):
        raise ValueError("Result set must have a revision "
                         "associated with it!")
    with transaction.atomic():
        push, _ = Push.objects.update_or_create(
            repository=repository,
            revision=result_set_revision,
            defaults={
                'revision_hash': result_set.get('revision_hash',
                                                result_set_revision),
                'author': result_set['author'],
                'time': datetime.utcfromtimestamp(
                    result_set['push_timestamp'])
            })
        for revision in result_set['revisions']:
            commit, _ = Commit.objects.update_or_create(
                push=push,
                revision=revision['revision'],
                defaults={
                    'author': revision['author'],
                    'comments': revision['comment']
                })


def store_result_set_data(repository, result_sets):
    """
    Stores "result sets" (legacy nomenclature) as push data in
    the treeherder database

    result_sets = [
        {
         "revision": "8afdb7debc82a8b6e0d56449dfdf916c77a7bf80",
         "push_timestamp": 1378293517,
         "author": "some-sheriff@mozilla.com",
         "revisions": [
            {
                "comment": "Bug 911954 - Add forward declaration of JSScript to TraceLogging.h, r=h4writer",
                "repository": "test_treeherder",
                "author": "John Doe <jdoe@mozilla.com>",
                "revision": "8afdb7debc82a8b6e0d56449dfdf916c77a7bf80"
                },
            ...
            ]
            },
        ...
        ]

    returns = {

        }
    """

    if not result_sets:
        logger.info("No new resultsets to store")
        return

    for result_set in result_sets:
        _store_push(repository, result_set)
