import logging
from cProfile import Profile

from django.conf import settings
from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.etl.buildapi import (Builds4hJobsProcess,
                                     PendingJobsProcess,
                                     RunningJobsProcess)
from treeherder.etl.pushlog import (HgPushlogProcess,
                                    last_push_id_from_server)
from treeherder.model.models import Repository

logger = logging.getLogger(__name__)


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
        parser.add_argument('--last-n-pushes', type=int,
                            help='fetch the last N pushes from the repository')

        parser.add_argument('project', help='repository to query')
        parser.add_argument('changeset', nargs='?', help='changeset to import')

    def _handle(self, *args, **options):
        project = options['project']
        changeset = options['changeset']

        if not options['last_n_pushes'] and not changeset:
            raise CommandError('must specify --last-n-pushes or a positional '
                               'changeset argument')

        # get reference to repo
        repo = Repository.objects.get(name=project, active_status='active')

        if options['last_n_pushes']:
            last_push_id = last_push_id_from_server(repo)
            fetch_push_id = max(1, last_push_id - options['last_n_pushes'])
            logger.info('last server push id: %d; fetching push %d and newer'
                        % (last_push_id, fetch_push_id))
        else:
            fetch_push_id = None

        # make sure all tasks are run synchronously / immediately
        settings.CELERY_ALWAYS_EAGER = True

        # get hg pushlog
        pushlog_url = '%s/json-pushes/?full=1&version=2' % repo.url

        # ingest this particular revision for this project
        process = HgPushlogProcess()
        # Use the actual push SHA, in case the changeset specified was a tag
        # or branch name (eg tip). HgPushlogProcess returns the full SHA.
        push_sha = process.run(pushlog_url, project, changeset=changeset,
                               last_push_id=fetch_push_id)

        # Only perform additional processing if fetching a single changeset
        # because we only have the sha1 if the tip-most push in "last N pushes"
        # mode and can't filter appropriately.
        if not fetch_push_id:
            group_filter = options['filter_job_group']
            Builds4hJobsProcess().run(project_filter=project,
                                      revision_filter=push_sha,
                                      job_group_filter=group_filter)
            PendingJobsProcess().run(project_filter=project,
                                     revision_filter=push_sha,
                                     job_group_filter=group_filter)
            RunningJobsProcess().run(project_filter=project,
                                     revision_filter=push_sha,
                                     job_group_filter=group_filter)

    def handle(self, *args, **options):

        if options['profile_file']:
            profiler = Profile()
            profiler.runcall(self._handle, *args, **options)
            profiler.dump_stats(options['profile_file'])
        else:
            self._handle(*args, **options)
