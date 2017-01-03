import time

import simplejson as json
from django.core.management.base import BaseCommand

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection


class Command(BaseCommand):
    """Management command to test log parsing"""
    help = """
    Tests the artifact parser by downloading a specified URL, parsing it,
    and then printing the JSON structure representing its result
    """

    def add_arguments(self, parser):
        parser.add_argument('log_url')
        parser.add_argument(
            '--profile',
            action='store',
            dest='profile',
            type=int,
            default=None,
            help='Profile running command a number of times'
        )

    def handle(self, *args, **options):
        if options['profile']:
            num_runs = options['profile']
        else:
            num_runs = 1

        times = []
        for i in range(num_runs):
            start = time.time()
            artifact_bc = ArtifactBuilderCollection(options['log_url'])
            artifact_bc.parse()
            times.append(time.time() - start)

            if not options['profile']:
                for name, artifact in artifact_bc.artifacts.items():
                    print("%s, %s" % (name, json.dumps(artifact)))

        if options['profile']:
            print("Timings: %s" % times)
            print("Average: %s" % (sum(times)/len(times)))
            print("Total: %s" % sum(times))
