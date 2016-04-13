import time
from optparse import make_option

import simplejson as json
from django.core.management.base import (BaseCommand,
                                         CommandError)

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection as PythonArtifactBuilderCollection
from treeherder.log_parser.rustlogparser import ArtifactBuilderCollection as RustArtifactBuilderCollection

class Command(BaseCommand):
    """Management command to test log parsing"""

    help = """
    Tests the artifact parser by downloading a specified URL, parsing it,
    and then printing the JSON structure representing its result
    """
    args = "<log url>"

    option_list = BaseCommand.option_list + (
        make_option('--profile',
                    action='store',
                    dest='profile',
                    type=int,
                    default=None,
                    help='Profile running command a number of times'),
        make_option('--rust',
                    action='store_true',
                    default=False,
                    help='Use rust parsers where available'),)

    def handle(self, *args, **options):
        if len(args) != 1:
            raise CommandError("Need to specify (only) log URL")

        if options['profile']:
            num_runs = options['profile']
        else:
            num_runs = 1

        times = []
        if options["rust"]:
            ArtifactBuilderCollection = RustArtifactBuilderCollection
        else:
            ArtifactBuilderCollection = PythonArtifactBuilderCollection
        for i in range(num_runs):
            start = time.time()
            artifact_bc = ArtifactBuilderCollection(args[0])
            artifact_bc.parse()
            times.append(time.time() - start)

            if not options['profile']:
                for name, artifact in artifact_bc.artifacts.items():
                    print("%s, %s" % (name, json.dumps(artifact)))

        if options['profile']:
            print("Timings: %s" % times)
            print("Average: %s" % (sum(times)/len(times)))
            print("Total: %s" % sum(times))
