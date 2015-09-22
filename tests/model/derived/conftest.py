import pytest


@pytest.fixture
def revision_params():
    return {
        "author": u"Mauro Doglio - <mdoglio@mozilla.com>",
        "comments": u"Bug 854583 - Use _pointer_ instead of...",
        "repository": u"mozilla-aurora",
        "revision": u"c91ee0e8a980",
    }
