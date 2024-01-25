"""
TODO: Remove this module entirely once all vcs data
 has been deleted from databases across all Treeherder
 environments (from prototype up to & including production).
 See bug https://bugzilla.mozilla.org/show_bug.cgi?id=1694335
"""
import time
from datetime import timedelta

from django.core.management.base import BaseCommand

from treeherder.model.data_cycling import MaxRuntime
from treeherder.perf.exceptions import MaxRuntimeExceeded
from treeherder.perf.models import PerformanceSignature


class Command(BaseCommand):
    help = "Remove all vcs data ingested by Perfherder"

    # max runtime
    PER_DELETE_SPRINT = timedelta(minutes=5)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.__timer = MaxRuntime(self.PER_DELETE_SPRINT)
        self.__timer.start_timer()

    def handle(self, *args, **options):
        vcs_signatures = PerformanceSignature.objects.filter(framework__name="vcs")
        for signature in vcs_signatures:
            signature.delete()  # intentionally cascades to data points also
            self._maybe_take_small_break()  # so database won't cripple; blocking call

    def _maybe_take_small_break(self):
        if self.__enough_work():
            time.sleep(10)

    def __enough_work(self) -> bool:
        try:
            self.__timer.quit_on_timeout()  # check timer
        except MaxRuntimeExceeded:
            self.__timer.start_timer()  # reset & restart it
            return True
        return False
