from django.core.management.base import BaseCommand
from django.utils.six.moves import input

from treeherder.model.models import (Datasource,
                                     Repository)


class Command(BaseCommand):
    help = "Populate the datasource table and create the connected databases"

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            dest='reset',
            default=False,
            help='Reset the datasources if they already exists'
        )

    def handle(self, *args, **options):
        if options["reset"]:
            confirm = input("""You have requested an init of the datasources.
This will IRREVERSIBLY DESTROY all data in the per-project databases.
Are you sure you want to do this?

Type 'yes' to continue, or 'no' to cancel: """)
            if confirm == "yes":
                for ds in Datasource.objects.all():
                    ds.delete()

        projects = Repository.objects.filter(active_status='active').values_list('name', flat=True)
        for project in projects:
            Datasource.objects.get_or_create(project=project)
        Datasource.reset_cache()
