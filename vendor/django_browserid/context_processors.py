# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.
from django_browserid import helpers


def browserid(request):
    """
    Context processor that adds django-browserid helpers to the template
    context.
    """
    return {
        'browserid_login': helpers.browserid_login,
        'browserid_logout': helpers.browserid_logout,
        'browserid_js': helpers.browserid_js,
        'browserid_css': helpers.browserid_css
    }
