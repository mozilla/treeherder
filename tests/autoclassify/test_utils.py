import time

from treeherder.autoclassify.utils import time_boxed


def test_time_boxed_enough_budget():
    an_iterable = range(3)

    def quick_sleep(x):
        time.sleep(0.1)
        return x

    items = list(time_boxed(quick_sleep, an_iterable, time_budget=5000))

    assert len(items) == 3


def test_time_boxed_cutoff():
    an_iterable = range(3)

    def quick_sleep(x):
        time.sleep(1)
        return x

    items = list(time_boxed(quick_sleep, an_iterable, time_budget=2000))

    assert len(items) < 3
