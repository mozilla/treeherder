# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from optparse import make_option
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
import sys

from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.model.derived import JobsModel, RefDataManager
from treeherder.model.tasks import process_objects
from treeherder.etl.buildapi import (RunningJobsProcess,
                                     PendingJobsProcess,
                                     Builds4hJobsProcess)
from cProfile import Profile

class Command(BaseCommand):
    """Management command to ingest data from a single push."""

    help = "Ingests a single push into treeherder"
    args = '<project> <changeset>'

    option_list = BaseCommand.option_list + (
        make_option('--profile-file',
            action='store',
            dest='profile_file',
            default=None,
            help='Profile command and write result to profile file'),
    )

    def _process_all_objects_for_project(self, project):
        jm = JobsModel(project)
        while jm.get_num_unprocessed_objects() > 0:
            process_objects.delay(project=project)

    def _handle(self, *args, **options):
        if len(args) != 2:
            raise CommandError("Need to specify (only) branch and changeset")

        (project, changeset) = args

        # get reference to repo
        rdm = RefDataManager()
        repos = filter(lambda x: x['name'] == project,
                       rdm.get_all_repository_info())
        if not repos:
            raise CommandError("No project found named '%s'" % project)
        repo = repos[0]

        # make sure all tasks are run synchronously / immediately
        settings.CELERY_ALWAYS_EAGER = True

        # get hg pushlog
        pushlog_url = '%s/json-pushes/?full=1' % repo['url']

        # ingest this particular revision for this project
        process = HgPushlogProcess()
        process.run(pushlog_url, project, changeset=changeset)

        self._process_all_objects_for_project(project)

        Builds4hJobsProcess().run(filter_to_project=project,
                                  filter_to_revision=changeset)
        PendingJobsProcess().run(filter_to_project=project,
                                 filter_to_revision=changeset)
        RunningJobsProcess().run(filter_to_project=project,
                                 filter_to_revision=changeset)

        self._process_all_objects_for_project(project)

    def handle(self, *args, **options):

        if options['profile_file']:
            profiler = Profile()
            profiler.runcall(self._handle, *args, **options)
            profiler.dump_stats(options['profile_file'])
        else:
            self._handle(*args, **options)
