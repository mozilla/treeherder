import logging
from datetime import datetime

from django.db import transaction

from treeherder.model.models import Commit, Push

logger = logging.getLogger(__name__)


def store_push(repository, push_dict):
    push_revision = push_dict.get('revision')
    if not push_dict.get('revision'):
        raise ValueError("Push must have a revision " "associated with it!")
    with transaction.atomic():
        push, _ = Push.objects.update_or_create(
            repository=repository,
            revision=push_revision,
            defaults={
                'author': push_dict['author'],
                'time': datetime.utcfromtimestamp(push_dict['push_timestamp']),
            },
        )
        for revision in push_dict['revisions']:
            Commit.objects.update_or_create(
                push=push,
                revision=revision['revision'],
                defaults={'author': revision['author'], 'comments': revision['comment']},
            )


def store_push_data(repository, pushes):
    """
    Stores push data in the treeherder database

    pushes = [
        {
         "revision": "8afdb7debc82a8b6e0d56449dfdf916c77a7bf80",
         "push_timestamp": 1378293517,
         "author": "some-sheriff@mozilla.com",
         "revisions": [
            {
                "comment": "Bug 911954 - Add forward declaration of JSScript to TraceLogging.h, r=h4writer",
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

    if not pushes:
        logger.info("No new pushes to store")
        return

    for push in pushes:
        store_push(repository, push)
