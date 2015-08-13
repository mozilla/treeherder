from optparse import make_option
from urlparse import urlparse

from django.core.management.base import BaseCommand

from treeherder.client import TreeherderClient
from treeherder.model.models import Option, OptionCollection, MachinePlatform


class Command(BaseCommand):

    help = "Pre-populate reference data from an external source (INCOMPLETE)"
    option_list = BaseCommand.option_list + (
        make_option('--server',
                    action='store',
                    dest='server',
                    default='https://treeherder.mozilla.org',
                    help='Server to get data from, default https://treeherder.mozilla.org'),
        )

    def handle(self, *args, **options):
        server_params = urlparse(options['server'])
        c = TreeherderClient(protocol=server_params.scheme,
                             host=server_params.netloc)

        # options / option collection hashes
        for (uuid, props) in c.get_option_collection_hash().iteritems():
            for prop in props:
                (option, _) = Option.objects.get_or_create(name=prop['name'])
                OptionCollection.objects.get_or_create(
                    option_collection_hash=uuid,
                    option=option)

        # machine platforms
        for machine_platform in c.get_machine_platforms():
            MachinePlatform.objects.get_or_create(
                    os_name=machine_platform['os_name'],
                    platform=machine_platform['platform'],
                    architecture=machine_platform['architecture'],
                    active_status=machine_platform['active_status']
                )

        # TODO: Implement other types: product, build platform, repository groups,
        # repositories, machine, job group, job type, failure classification
