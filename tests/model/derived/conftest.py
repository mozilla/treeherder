import pytest
from treeherder.log_parser import tasks
from celery import task


@task
def task_mock(*args, **kwargs):
    pass


@pytest.fixture
def mock_log_parser():
    old_func = tasks.parse_log
    tasks.parse_log = task_mock

    def fin():
        tasks.parse_log = old_func

@pytest.fixture
def revision_params():
    return {
        "author": u"Mauro Doglio - <mdoglio@mozilla.com>",
        "commit_timestamp": 1365732271, # this is nullable
        "comments": u"Bug 854583 - Use _pointer_ instead of...",
        "repository": u"mozilla-aurora",
        "revision": u"c91ee0e8a980",
        "files": [
            "file1",
            "file2"
        ]
    }
