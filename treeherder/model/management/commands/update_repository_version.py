from optparse import make_option
from django.core.management.base import BaseCommand
from treeherder.model.derived import RefDataManager
from treeherder.model.models import Repository


class Command(BaseCommand):
    help = """Update the given repository version. Only hg repositories are supported for now and the repo must have an active_status of 'active'."""

    option_list = BaseCommand.option_list + (
        make_option('--group',
            action='store',
            dest='group',
            default=None,
            help='Filter the repositories to update by group name'),
        make_option('--repo-name',
            action='store',
            dest='repo_name',
            default=None,
            help='Filter the repositories to update by name'),
        make_option('--codebase',
            action='store',
            dest='codebase',
            default=None,
            help='Filter the repositories to update by codebase'),
    )

    def handle(self, *args, **options):
        repositories = Repository.objects.filter(active_status='active')
        if options['repo_name']:
            repositories = repositories.filter(name=options['repo_name'])
        if options['codebase']:
            repositories = repositories.filter(codebase=options['codebase'])
        if options['group']:
            repositories = repositories.filter(
                repository_group__name=options['group'])

        repo_ids = repositories.values_list('id', flat=True)
        
        refdata = RefDataManager()
        
        for repo_id in repo_ids:
            refdata.update_repository_version(repo_id)
