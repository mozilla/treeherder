# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import pytest


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
