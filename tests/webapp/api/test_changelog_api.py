from datetime import datetime

from django.db import transaction
from django.urls import reverse

from treeherder.changelog.models import (Changelog,
                                         ChangelogFile)


def test_changelog_list(client, test_job_with_notes):
    """
    test retrieving a list of changes from the changelog endpoint
    """
    # adding some data
    entry = {
        "date": datetime.now(),
        "author": "tarek",
        "message": "commit",
        "remote_id": "2689367b205c16ce32ed4200942b8b8b1e262dfc70d9bc9fbc77c49699a4f1df",
        "type": "commit",
        "url": "http://example.com/some/url",
    }
    files = ["file1", "file2", "file3"]
    with transaction.atomic():
        changelog = Changelog.objects.create(**entry)
        [ChangelogFile.objects.create(name=name, changelog=changelog) for name in files]

    # now let's check that we get it from the API call
    resp = client.get(reverse("changelog-list"))

    assert resp.status_code == 200
    result = resp.json()
    assert result[0]["files"] == ["file1", "file2", "file3"]
    assert result[0]["author"] == "tarek"
