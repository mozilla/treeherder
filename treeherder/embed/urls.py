# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.
from django.conf.urls import patterns, url
from .views import ResultsetStatusView

urlpatterns = patterns(
    '',
    url(r'^resultset-status/(?P<repository>[\w-]{0,50})/(?P<revision>\w+)/$',
        ResultsetStatusView.as_view(), name="resultset_status"),
)
