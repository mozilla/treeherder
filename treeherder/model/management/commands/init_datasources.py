from django.core.management.base import BaseCommand
from treeherder.model.models import Datasource, Repository


class Command(BaseCommand):
    help = ("Populate the datasource table and"
            "create the connected databases")

    def handle(self, *args, **options):
        projects = Repository.objects.all().values_list('name',flat=True)
        for project in projects:
        	for contenttype in ("jobs","objectstore"):
	        	Datasource.objects.get_or_create(
                    contenttype=contenttype,
                    dataset=1,
                    project=project
                )
