import logging

from celery.canvas import Signature
from django.db import transaction

from treeherder.model.models import TaskSetMeta

logger = logging.getLogger(__name__)


def taskset(f):
    """Decorator for creating a taskset i.e. a set of tasks that execute and
    then call a callback task once all tasks in the set are complete. This is
    much like a chord in MySQL but has fewer features and is designed to be
    lighter-weight. In particular it does not support passing results into the
    callback, and uses the database backend with a counter for synchronisation
    so does not generate any additional messages.

    The implementation puts the data for the callback uses an extra kwarg
    _taskset, so it is not supported for a task using this decorator to
    use that as a kwarg."""
    def inner(*args, **kwargs):
        taskset = kwargs.pop("_taskset", None)
        rv = f(*args, **kwargs)
        if taskset is not None:
            done = False
            with transaction.atomic():
                taskset_id = taskset["taskset_id"]
                sync_row = TaskSetMeta.objects.select_for_update().filter(
                    id=taskset_id).all()
                if sync_row:
                    assert len(sync_row) == 1
                    sync_row = sync_row[0]
                    sync_row.count -= 1
                    sync_row.save()
                    if sync_row.count == 0:
                        logger.info("Finished taskset id %i" % taskset_id)
                        done = True
                    else:
                        logger.info("Taskset %i has %i tasks remaining" % (taskset_id, sync_row.count))
            if done:
                callback = Signature.from_dict(taskset["callback"])
                callback.apply_async()
        return rv
    inner.__name__ = f.__name__
    inner.__doc__ = f.__doc__
    return inner


def create_taskset(tasks, callback):
    """Create a taskset i.e. a group of tasks that are all run before another
    task is called.

    :param tasks: List of celery Signature objects for the tasks in the set.
    :param callback: Celery Signature object for the callback to run
    """

    tasks = tasks
    callback = callback

    num_tasks = len(tasks)

    sync_row = TaskSetMeta(count=num_tasks)
    sync_row.save()

    taskset_data = {"callback": callback,
                    "taskset_id": sync_row.id}

    for task_signature in tasks:
        task_signature.kwargs["_taskset"] = taskset_data
        task_signature.apply_async()
