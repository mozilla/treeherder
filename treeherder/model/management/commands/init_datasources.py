# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from optparse import make_option
from django.utils.six.moves import input

from django.conf import settings

from django.core.management.base import BaseCommand
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

        projects = Repository.objects.filter(active_status='active').values_list('name', flat=True)
        for project in projects:
            for contenttype in ("jobs", "objectstore"):
                Datasource.objects.get_or_create(
                    contenttype=contenttype,
                    dataset=1,
                    project=project,
                    host=options['host'],
                    read_only_host=options['readonly_host']
                )
        Datasource.reset_cache()
