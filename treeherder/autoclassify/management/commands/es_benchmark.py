import json
import logging
import time
from collections import defaultdict

from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.autoclassify import matchers
from treeherder.etl.common import fetch_text
from treeherder.model.models import FailureLine

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Mark failures on a job.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-id',
            action='store',
            type=int,
            default=None,
            help='Minimum id of failure line to use'
        )
        parser.add_argument(
            '--num-lines',
            action='store',
            type=int,
            default=1000,
            help='Minimum id of failure line to use'
        )
        parser.add_argument(
            '--profile',
            action='store',
            default=None,
            help='Enable profiling and write output to this file'
        )
        parser.add_argument(
            '--ref-data',
            action='store',
            default=None,
            help='json file to compare results to'
        )

    def handle(self, *args, **options):
        if options["min_id"] is None:
            options["min_id"] = (FailureLine.objects
                                 .filter(action="test_result")
                                 .exclude(message=None)
                                 .exclude(message="")
                                 .order_by("-id")
                                 .values_list("id", flat=True)[options["num_lines"]])

        failure_lines = (FailureLine.objects
                         .filter(id__gt=options["min_id"],
                                 action="test_result")
                         .exclude(message=None)
                         .exclude(message="")
                         .order_by("id")[:options["num_lines"]])

        self.stderr.write("Using min id %d" % options["min_id"])
        self.stderr.write("Got %d lines" % len(failure_lines))

        t0 = time.time()
        fetch_text(settings.ELASTIC_SEARCH["url"])
        self.stderr.write("Simple GET took %dms" % ((time.time() - t0) * 1000))

        failure_lines_by_job = defaultdict(list)
        for line in failure_lines:
            failure_lines_by_job[line.job_guid].append(line)

        matcher = matchers.ElasticSearchTestMatcher(None)
        all_matches = {}

        if options["profile"]:
            import cProfile
            prof = cProfile.Profile()
            prof.enable()

        total_lines = 0
        t0 = time.time()
        for job_guid, failure_lines in failure_lines_by_job.iteritems():
            total_lines += len(failure_lines)
            matches = matcher(failure_lines)
            all_matches[job_guid] = matches

        duration = 1000 * (time.time() - t0)
        self.stderr.write("Total lines %d" % total_lines)
        self.stderr.write("Total lines in matcher %d" % matcher.lines)
        self.stderr.write("Called ElasticSearch %i times" % matcher.calls)
        self.stderr.write("Took %dms" % duration)

        if options["profile"]:
            prof.disable()
            prof.dump_stats(options["profile"])

        json_data = {}
        for key, values in all_matches.iteritems():
            json_values = [[item[0].id, item[1].id, item[2]] for item in values]
            json_data[key] = json_values

        json_string = json.dumps(json_data)
        if options["ref_data"]:
            with open(options["ref_data"]) as f:
                ref_data = json.load(f)
            this_data = json.loads(json_string)
            if this_data == ref_data:
                self.stderr.write("Output matches refdata")
            else:
                self.stderr.write("Output does not match refdata")

        self.stdout.write(json_string)
