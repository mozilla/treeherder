from optparse import make_option

from django.conf import settings

from django.core.management.base import BaseCommand, CommandError
from treeherder.model.models import Datasource, Repository


class Command(BaseCommand):
    help = ("Populate the datasource table and"
            "create the connected databases")

    option_list = BaseCommand.option_list + (
        make_option('--host',
            action='store',
            dest='host',
            default=settings.TREEHERDER_DATABASE_HOST,
            help='Host to associate the datasource to'),
        make_option('--readonly-host',
            action='store',
            dest='readonly_host',
            default=settings.TREEHERDER_DATABASE_HOST,
            help='Readonly host to associate the datasource to'),
    )

    def handle(self, *args, **options):
        projects = Repository.objects.all().values_list('name', flat=True)
        for project in projects:
            for contenttype in ("jobs","objectstore"):
                Datasource.objects.get_or_create(
                    contenttype=contenttype,
                    dataset=1,
                    project=project,
                    host=options['host'],
                    read_only_host=options['readonly_host']
                )
        Datasource.reset_cache()
