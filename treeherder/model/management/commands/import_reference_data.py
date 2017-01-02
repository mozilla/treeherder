from django.core.management.base import BaseCommand

from treeherder.client import TreeherderClient
from treeherder.model.models import (BuildPlatform,
                                     FailureClassification,
                                     JobGroup,
                                     JobType,
                                     Machine,
                                     MachinePlatform,
                                     Option,
                                     OptionCollection,
                                     Product,
                                     Repository,
                                     RepositoryGroup)


class Command(BaseCommand):
    help = "Pre-populate reference data from an external source (INCOMPLETE)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--server',
            action='store',
            dest='server',
            default='https://treeherder.mozilla.org',
            help='Server to get data from, default https://treeherder.mozilla.org'
        )

    def handle(self, *args, **options):
        c = TreeherderClient(server_url=options['server'])

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
                    architecture=machine_platform['architecture'])

        # machine
        for machine in c.get_machines():
            Machine.objects.get_or_create(
                    id=machine['id'],
                    name=machine['name'],
                    defaults={
                        'first_timestamp': machine['first_timestamp'],
                        'last_timestamp': machine['last_timestamp']
                    })

        # job group
        for job_group in c.get_job_groups():
            JobGroup.objects.get_or_create(
                    id=job_group['id'],
                    symbol=job_group['symbol'],
                    name=job_group['name'],
                    defaults={
                        'description': job_group['description']
                    })

        # job type
        for job_type in c.get_job_types():
            try:
                jgroup = JobGroup.objects.get(id=job_type['job_group'])
                JobType.objects.get_or_create(
                    id=job_type['id'],
                    symbol=job_type['symbol'],
                    name=job_type['name'],
                    defaults={
                        'job_group': jgroup,
                        'description': job_type['description']
                    })
            except JobGroup.DoesNotExist:
                # ignore job types whose job group does not exist
                self.stderr.write("WARNING: Job type '{}' ({}) references a "
                                  "job group ({}) which does not have an "
                                  "id".format(job_type['symbol'], job_type['name'],
                                              job_type['job_group']))

        # product
        for product in c.get_products():
            Product.objects.get_or_create(
                    id=product['id'],
                    name=product['name'],
                    defaults={
                        'description': product['description']
                    })

        # failure classification
        for failure_classification in c.get_failure_classifications():
            FailureClassification.objects.get_or_create(
                    id=failure_classification['id'],
                    name=failure_classification['name'],
                    defaults={
                        'description': failure_classification['description']
                    })

        # build platform
        for build_platform in c.get_build_platforms():
            BuildPlatform.objects.get_or_create(
                    id=build_platform['id'],
                    os_name=build_platform['os_name'],
                    defaults={
                        'platform': build_platform['platform'],
                        'architecture': build_platform['architecture']
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
