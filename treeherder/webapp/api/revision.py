# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from treeherder.webapp.api.utils import with_jobs


class RevisionLookupSetViewSet(viewsets.ViewSet):

    @with_jobs
    def list(self, request, project, jm):

        revision_filter = request.QUERY_PARAMS.get('revision', None)
        if not revision_filter:
            raise ParseError(detail="The revision parameter is mandatory for this endpoint")

        revision_list = revision_filter.split(",")

        return Response(jm.get_revision_resultset_lookup(revision_list))

