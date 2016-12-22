import datetime
import time

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils.six.moves import input

from treeherder.model.models import Push
from treeherder.perf.models import (PerformanceDatum,
                                    PerformanceSignature)


class Command(BaseCommand):
    help = "Populate a test set of data suitable for testing the perfherder UI"

    def handle(self, *args, **options):

        confirm = input("""
You have a requested a load of test performance data, this is a destructive
operation that should only be performed on a development instance.

Type 'yes' to continue, or 'no' to cancel: """)
        if confirm != "yes":
            return

        call_command('loaddata', 'test_performance_data')

        # generating a test performance series by hand is a little overly
        # verbose, so let's do that programmatically
        s = PerformanceSignature.objects.get(id=1)
        PerformanceDatum.objects.filter(signature=s).delete()
        INTERVAL = 30
        now = time.time()

        # create a push first as need a push_id
        Push.objects.create(
            repository=s.repository,
            revision='1234abcd',
            author='foo@bar.com',
            time=datetime.datetime.now())

        for (t, v) in zip([i for i in range(INTERVAL)],
                          ([0.5 for i in range(INTERVAL/2)] +
                           [1.0 for i in range(INTERVAL/2)])):
            PerformanceDatum.objects.create(
                repository=s.repository,
                result_set_id=t,
                ds_job_id=t,
                signature=s,
                push_timestamp=datetime.datetime.utcfromtimestamp(now + (t * 60 * 60)),
                push_id=1,
                value=v)
