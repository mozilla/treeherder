# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.conf import settings
from django.core.management.base import BaseCommand
import sys

from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.model.derived import RefDataManager
from treeherder.model.tasks import process_objects
from treeherder.etl.buildapi import (RunningJobsProcess,
                                     PendingJobsProcess,
                                     Builds4hJobsProcess)

class Command(BaseCommand):
    """Management command to ingest data from a single push."""

    help = "Ingests a single push into treeherder"
    args = '<reponame> <changeset>'

    def error(self, message, code=1):
        """
        Prints the error, and exits with the given code.
        """
        print >>sys.stderr, message
        sys.exit(code)

    def handle(self, *args, **options):
        if len(args) != 2:
            self.error("Need to specify (only) branch and changeset")

        (reponame, changeset) = args
        print (reponame, changeset)

        # get reference to repo
        rdm = RefDataManager()
        repos = filter(lambda x: x['name'] == reponame,
                       rdm.get_all_repository_info())
        if not repos:
            self.error("No repo found named '%s'" % reponame)
        repo = repos[0]

        # make sure all tasks are run synchronously / immediately
        settings.CELERY_ALWAYS_EAGER = True

        # get hg pushlog
        pushlog_url = '%s/json-pushes/?full=1&changeset=%s' % (repo['url'],
                                                               changeset)
        process = HgPushlogProcess()
        process.run(pushlog_url, reponame)

        PendingJobsProcess().run(filter_to_revision=changeset)
        RunningJobsProcess().run(filter_to_revision=changeset)
        Builds4hJobsProcess().run(filter_to_revision=changeset)

        process_objects.delay()
