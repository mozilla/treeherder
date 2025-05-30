import requests
from django.conf import settings
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.model.models import Bugscache, BugzillaSecurityGroup
from treeherder.utils.bugzilla import get_bug_url
from treeherder.utils.http import make_request


class BugzillaViewSet(viewsets.ViewSet):
    @action(detail=False, methods=["post"])
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

        description = "**Filed by:** {}\n{}".format(
            request.user.email.replace("@", " [at] "), params.get("comment", "")
        ).encode("utf-8")
        summary = params.get("summary").encode("utf-8").strip()
        url = settings.BUGFILER_API_URL + "/rest/bug"
        headers = {
            "x-bugzilla-api-key": settings.BUGFILER_API_KEY,
            "Accept": "application/json",
        }
        data = {
            "type": "defect",
            "product": params.get("product"),
            "component": params.get("component"),
            "summary": summary,
            "keywords": params.get("keywords"),
            "whiteboard": params.get("whiteboard"),
            "regressed_by": params.get("regressed_by"),
            "see_also": params.get("see_also"),
            "version": params.get("version"),
            "cf_crash_signature": params.get("crash_signature"),
            "severity": params.get("severity"),
            "priority": params.get("priority"),
            "description": description,
            "comment_tags": "treeherder",
        }

        # Only Perfherder is setting the param needinfo_from when filing a regression bug
        if params.get("needinfo_from"):
            data["type"] = params.get("type")
            data["description"] = params.get("description").encode("utf-8")
            data["cc"] = params.get("cc")
            data["flags"] = [
                {
                    "name": "needinfo",
                    "status": "?",
                    "requestee": params.get("needinfo_from"),
                }
            ]
            # For critical alerts sheriffs are requesting from sheriffs@mozilla.bugs an immediate backout
            if params.get("is_backout_requested"):
                data["flags"].append(
                    {
                        "name": "needinfo",
                        "status": "?",
                        "requestee": "sheriffs@mozilla.bugs",
                    }
                )

        if params.get("is_security_issue"):
            security_group_list = list(
                BugzillaSecurityGroup.objects.filter(product=data.get("product")).values_list(
                    "security_group", flat=True
                )
            )
            if len(security_group_list) == 0:
                return Response(
                    {
                        "failure": "Cannot file security bug for product without default security group in Bugzilla."
                    },
                    status=HTTP_400_BAD_REQUEST,
                )
            data["groups"] = security_group_list

        try:
            response = make_request(url, method="POST", headers=headers, json=data)
        except requests.exceptions.HTTPError as e:
            try:
                message = e.response.json()["message"]
            except (ValueError, KeyError):
                message = e.response.text
            return Response({"failure": message}, status=HTTP_400_BAD_REQUEST)

        bug_id = response.json()["id"]
        summary = summary.decode("utf-8")
        # Creation API only returns the ID, but the bug will be updated later on by `treeherder.etl.bugzilla.BzApiBugProcess`
        bug = Bugscache.objects.filter(bugzilla_id=bug_id).first()
        if not bug:
            bugs = list(Bugscache.objects.filter(summary=summary).order_by("modified"))
            if bugs and not (bug := next((b.bugzilla_id == bug_id for b in bugs), None)):
                bug = bugs[-1]
                bug.modified = timezone.now()
                bug.bugzilla_id = bug_id
                bug.save()
        internal_id = bug.id if bug else None
        return Response(
            {
                "id": bug_id,
                "internal_id": internal_id,
                "url": get_bug_url(bug_id, settings.BUGFILER_API_URL),
            }
        )
