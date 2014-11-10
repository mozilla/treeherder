# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from optparse import make_option
from django.core.management.base import BaseCommand
from treeherder.model.models import Repository
from treeherder.model.derived import JobsModel
from treeherder.model.tasks import publish_to_pulse

class Command(BaseCommand):
    help = """Cycle data that exceeds the time constraint limit"""

    option_list = BaseCommand.option_list + (

        make_option('--project',
            action='store_true',
            dest='project',
            default='mozilla-inbound',
            help='Name of the treeherder project: mozilla-inbound, mozilla-aurora etc...'),

        make_option('--result_set_ids',
            action='store',
            dest='result_set_ids',
            default=1,
            help='Comma delimited list of result set ids to publish to pulse'),
    )

    def handle(self, *args, **options):

        project = options.get("project")

        result_set_ids = map(
            lambda x: int(x or 0),
            options.get("result_set_ids", "1").split(',')
            )

        publish_to_pulse(project, result_set_ids, 'result_set')
