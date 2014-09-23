from optparse import make_option
from django.utils.six.moves import input

from django.conf import settings

from django.core.management.base import BaseCommand, CommandError
from django.core.cache import cache
from treeherder.model.models import Datasource, Repository
from treeherder.etl.pushlog import PUSHLOG_CACHE_KEY


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
        make_option('--reset',
            action='store_true',
            dest='reset',
            default=False,
            help='Reset the datasources if they already exists'),
    )

    def handle(self, *args, **options):
        if options["reset"]:
            confirm = input("""You have requested an init of the datasources.
This will IRREVERSIBLY DESTROY all data in the jobs and objectstore databases.
Are you sure you want to do this?

Type 'yes' to continue, or 'no' to cancel: """)
            if confirm == "yes":
                for ds in Datasource.objects.all():
                    ds.delete()

        projects = Repository.objects.all().values_list('name', flat=True)
        for project in projects:
            for contenttype in ("jobs", "objectstore"):
                Datasource.objects.get_or_create(
                    contenttype=contenttype,
                    dataset=1,
                    project=project,
                    host=options['host'],
                    read_only_host=options['readonly_host']
                )
            # clear the pushlog cache
            cache.delete(PUSHLOG_CACHE_KEY.format(project))
        Datasource.reset_cache()
