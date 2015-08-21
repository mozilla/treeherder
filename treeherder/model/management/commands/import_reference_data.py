from optparse import make_option
from urlparse import urlparse

from django.core.management.base import BaseCommand

from treeherder.client import TreeherderClient
from treeherder.model.models import Option, OptionCollection, MachinePlatform, Machine, JobGroup, Product
from treeherder.model.models import FailureClassification, BuildPlatform, JobType, Repository, RepositoryGroup


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
                option, _ = Option.objects.get_or_create(name=prop['name'])
                OptionCollection.objects.get_or_create(
                    option_collection_hash=uuid,
                    option=option)

        # machine platforms
        for machine_platform in c.get_machine_platforms():
            MachinePlatform.objects.get_or_create(
                    os_name=machine_platform['os_name'],
                    platform=machine_platform['platform'],
                    architecture=machine_platform['architecture'],
                    defaults={
                        'active_status': machine_platform['active_status']
                    })

        # machine
        for machine in c.get_machines():
            Machine.objects.get_or_create(
                    id=machine['id'],
                    name=machine['name'],
                    defaults={
                        'first_timestamp': machine['first_timestamp'],
                        'last_timestamp': machine['last_timestamp'],
                        'active_status': machine['active_status']
                    })

        # job group
        for job_group in c.get_job_groups():
            JobGroup.objects.get_or_create(
                    id=job_group['id'],
                    symbol=job_group['symbol'],
                    name=job_group['name'],
                    defaults={
                        'description': job_group['description'],
                        'active_status': job_group['active_status']
                    })

        # job type
        for job_type in c.get_job_types():
            jgroup = JobGroup.objects.get(id=job_type['job_group'])
            JobType.objects.get_or_create(
                    id=job_type['id'],
                    symbol=job_type['symbol'],
                    name=job_type['name'],
                    defaults={
                        'job_group': jgroup,
                        'description': job_type['description'],
                        'active_status': job_type['active_status']
                    })

        # product
        for product in c.get_products():
            Product.objects.get_or_create(
                    id=product['id'],
                    name=product['name'],
                    defaults={
                        'description': product['description'],
                        'active_status': product['active_status']
                    })

        # failure classification
        for failure_classification in c.get_failure_classifications():
            FailureClassification.objects.get_or_create(
                    id=failure_classification['id'],
                    name=failure_classification['name'],
                    defaults={
                        'description': failure_classification['description'],
                        'active_status': failure_classification['active_status']
                    })

        # build platform
        for build_platform in c.get_build_platforms():
            BuildPlatform.objects.get_or_create(
                    id=build_platform['id'],
                    os_name=build_platform['os_name'],
                    defaults={
                        'platform': build_platform['platform'],
                        'architecture': build_platform['architecture'],
                        'active_status': build_platform['active_status']
                    })

        # repository and repository group
        for repository in c.get_repositories():
            rgroup, _ = RepositoryGroup.objects.get_or_create(
                    name=repository['repository_group']['name'],
                    description=repository['repository_group']['description']
                    )
            Repository.objects.get_or_create(
                    id=repository['id'],
                    repository_group=rgroup,
                    name=repository['name'],
                    dvcs_type=repository['dvcs_type'],
                    url=repository['url'],
                    defaults={
                        'codebase': repository['codebase'],
                        'description': repository['description'],
                        'active_status': repository['active_status']
                    })
