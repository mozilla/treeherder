# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this file,
# You can obtain one at http://mozilla.org/MPL/2.0/.
from analyze_talos import bugs_from_comments

assert bugs_from_comments("Bug 12345") == [12345]
assert bugs_from_comments("bug12345") == [12345]
assert bugs_from_comments("b12345") == [12345]
assert bugs_from_comments("Bugs 12345, 67890") == [12345, 67890]
assert bugs_from_comments("Fix instanceof with bound functions (bug 597167, r=brendan).") == [597167]
assert bugs_from_comments("Backed out changeset f8854fb6b63f - Wrong patch attached to the bug.") == []
