from cProfile import Profile

from django.conf import settings
from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.etl.buildapi import (Builds4hJobsProcess,
                                     PendingJobsProcess,
                                     RunningJobsProcess)
from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.model.models import Repository


class Command(BaseCommand):

    """Management command to ingest data from a single push."""

    help = "Ingests a single push into treeherder"

    def add_arguments(self, parser):
        parser.add_argument('--profile-file',
                            help='Profile command and write result to profile '
                            'file')
        parser.add_argument('--filter-job-group',
                            help="Only process jobs in specified group symbol "
                            "(e.g. 'T')")

        parser.add_argument('project', help='repository to query')
        parser.add_argument('changeset', help='changeset to import')

    def _handle(self, *args, **options):
        project = options['project']
        changeset = options['changeset']

        # get reference to repo
        repo = Repository.objects.get(name=project, active_status='active')

        # make sure all tasks are run synchronously / immediately
        settings.CELERY_ALWAYS_EAGER = True

        # get hg pushlog
        pushlog_url = '%s/json-pushes/?full=1&version=2' % repo.url

        # ingest this particular revision for this project
        process = HgPushlogProcess()
        # Use the actual push SHA, in case the changeset specified was a tag
        # or branch name (eg tip). HgPushlogProcess returns the full SHA.
        push_sha = process.run(pushlog_url, project, changeset=changeset)

        Builds4hJobsProcess().run(project_filter=project,
                                  revision_filter=push_sha,
                                  job_group_filter=options['filter_job_group'])
        PendingJobsProcess().run(project_filter=project,
                                 revision_filter=push_sha,
                                 job_group_filter=options['filter_job_group'])
        RunningJobsProcess().run(project_filter=project,
                                 revision_filter=push_sha,
                                 job_group_filter=options['filter_job_group'])

    def handle(self, *args, **options):

        if options['profile_file']:
            profiler = Profile()
            profiler.runcall(self._handle, *args, **options)
            profiler.dump_stats(options['profile_file'])
        else:
            self._handle(*args, **options)
