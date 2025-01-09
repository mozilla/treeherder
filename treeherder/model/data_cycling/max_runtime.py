from datetime import datetime, timedelta

from treeherder.perf.exceptions import MaxRuntimeExceededError


class MaxRuntime:
    DEFAULT_MAX_RUNTIME = timedelta(hours=23)

    def __init__(
        self,
        max_runtime: timedelta = None,
    ):
        self.started_at = None
        self.max_runtime = max_runtime or MaxRuntime.DEFAULT_MAX_RUNTIME

    def quit_on_timeout(self):
        elapsed_runtime = datetime.now() - self.started_at

        if self.max_runtime < elapsed_runtime:
            raise MaxRuntimeExceededError("Max runtime for performance data cycling exceeded")

    def start_timer(self):
        self.started_at = datetime.now()
