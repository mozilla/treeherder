# coding: utf-8

import requests
from django.conf import settings
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.utils.http import make_request


class BugzillaViewSet(viewsets.ViewSet):
    @action(detail=False, methods=['post'])
    def create_bug(self, request):
        """
        Create a bugzilla bug with passed params
        """
        if settings.BUGFILER_API_KEY is None:
            return Response({"failure": "Bugzilla API key not set!"}, status=HTTP_400_BAD_REQUEST)

        params = request.data

        # Arbitrarily cap crash signatures at 2048 characters to prevent perf issues on bmo
        crash_signature = params.get("crash_signature")
        if crash_signature and len(crash_signature) > 2048:
            return Response(
                {"failure": "Crash signature can't be more than 2048 characters."},
                status=HTTP_400_BAD_REQUEST,
            )

        description = u"**Filed by:** {}\n{}".format(
            request.user.email.replace('@', " [at] "), params.get("comment", "")
        ).encode("utf-8")
        summary = params.get("summary").encode("utf-8").strip()
        url = settings.BUGFILER_API_URL + "/rest/bug"
        headers = {'x-bugzilla-api-key': settings.BUGFILER_API_KEY, 'Accept': 'application/json'}
        data = {
            'type': "defect",
            'product': params.get("product"),
            'component': params.get("component"),
            'summary': summary,
            'keywords': params.get("keywords"),
            'whiteboard': params.get("whiteboard"),
            'regressed_by': params.get("regressed_by"),
            'see_also': params.get("see_also"),
            'version': params.get("version"),
            'cf_crash_signature': params.get("crash_signature"),
            'severity': params.get("severity"),
            'priority': params.get("priority"),
            'description': description,
            'comment_tags': "treeherder",
        }

        try:
            response = make_request(url, method='POST', headers=headers, json=data)
        except requests.exceptions.HTTPError as e:
            try:
                message = e.response.json()['message']
            except (ValueError, KeyError):
                message = e.response.text
            return Response({"failure": message}, status=HTTP_400_BAD_REQUEST)

        return Response({"success": response.json()["id"]})
