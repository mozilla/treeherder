import binascii
import json
import os
import warnings
from contextlib import contextmanager
from datetime import (datetime,
                      timedelta)

warnings.filterwarnings("ignore", category=DeprecationWarning, module="github3")
from treeherder.changelog.collector import collect  # noqa isort:skip
from treeherder.changelog.collector import github3  # noqa isort:skip


def random_id():
    return binascii.hexlify(os.urandom(16)).decode("utf8")


class Release:
    def as_json(self):
        now = datetime.now()
        return json.dumps(
            {
                "name": "ok",
                "published_at": now.strftime("%Y-%m-%dT%H:%M:%S"),
                "id": random_id(),
                "html_url": "url",
                "tag_name": "some tag",
                "author": {"login": "tarek"},
            }
        )


class Commit:
    files = [{"filename": "file1"}, {"filename": "file2"}]

    def as_json(self):
        now = datetime.now().strftime("%Y-%m-%dT%H:%M:%S")
        return json.dumps(
            {
                "name": "ok",
                "sha": random_id(),
                "html_url": "url",
                "tag_name": "some tag",
                "commit": {
                    "message": "yeah",
                    "author": {"name": "tarek", "date": now},
                    "files": self.files,
                },
            }
        )


class FakeGithub:
    def __init__(self, *args, **kw):
        pass

    def repository(self, *args):
        return self

    def releases(self, **kw):
        return [Release(), Release()]

    def commits(self, **kw):
        return [Commit(), Commit(), Commit()]

    def commit(self, sha):
        return Commit()


@contextmanager
def fake_env(*keys):
    old_values = [(key, os.environ.get(key)) for key in keys]
    for key in keys:
        os.environ[key] = "fake"

    old_g3 = github3.login
    github3.login = FakeGithub
    try:
        yield
    finally:
        github3.login = old_g3
        for key, old_value in old_values:
            if old_value is None:
                del os.environ[key]
            else:
                os.environ[key] = old_value


def test_collect():
    yesterday = datetime.now() - timedelta(days=1)
    yesterday = yesterday.strftime("%Y-%m-%dT%H:%M:%S")

    with fake_env("GITHUB_CLIENT_SECRET", "GITHUB_CLIENT_ID"):
        res = list(collect(yesterday))

    # we're not looking into much details here, we can do this
    # once we start to tweak the filters
    assert len(res) > 0
