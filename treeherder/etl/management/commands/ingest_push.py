from cProfile import Profile
from optparse import make_option

from django.conf import settings
from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.etl.buildapi import (Builds4hJobsProcess,
                                     PendingJobsProcess,
                                     RunningJobsProcess)
from treeherder.etl.pushlog import HgPushlogProcess
from treeherder.model.derived import RefDataManager


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

        make_option('--filter-job-group',
                    action='store',
                    dest='filter_job_group',
                    default=None,
                    help="Only process jobs in specified group symbol "
                    "(e.g. 'T')")
    )

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
        pushlog_url = '%s/json-pushes/?full=1&version=2' % repo['url']

        # ingest this particular revision for this project
        process = HgPushlogProcess()
        # Use the actual push SHA, in case the changeset specified was a tag
        # or branch name (eg tip). HgPushlogProcess returns the full SHA.
        push_sha = process.run(pushlog_url, project, changeset=changeset)[:12]

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
