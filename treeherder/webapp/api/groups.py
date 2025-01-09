import datetime
import logging
import re

from django.db.models import Count
from rest_framework import generics
from rest_framework.response import Response

from treeherder.model.models import Job
from treeherder.webapp.api.serializers import GroupNameSerializer

logger = logging.getLogger(__name__)


class SummaryByGroupName(generics.ListAPIView):
    """
    This yields group names/status summary for the given group and day.
    """

    serializer_class = GroupNameSerializer
    queryset = None

    def list(self, request):
        startdate = None
        enddate = None
        if "startdate" in request.query_params:
            startdate = request.query_params["startdate"]

        if not startdate or not re.match(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$", startdate):
            startdate = datetime.datetime.today()
        else:
            startdate = datetime.datetime.strptime(startdate, "%Y-%m-%d")

        if "enddate" in request.query_params:
            enddate = request.query_params["enddate"]

        if not enddate or not re.match(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$", enddate):
            enddate = startdate + datetime.timedelta(days=1)
        else:
            enddate = datetime.datetime.strptime(enddate, "%Y-%m-%d")

        if (enddate - startdate).days > 1:
            enddate = startdate + datetime.timedelta(days=1)

        q = (
            Job.objects.filter(
                push__time__gte=str(startdate.date()), push__time__lte=str(enddate.date())
            )
            .filter(repository_id__in=(1, 77))
            .values(
                "job_log__groups__name",
                "job_type__name",
                "job_log__group_result__status",
                "failure_classification_id",
            )
            .annotate(job_count=Count("id"))
            .order_by("job_log__groups__name")
        )
        self.queryset = q
        serializer = self.get_serializer(self.queryset, many=True)
        summary = {}
        job_type_names = []
        for item in serializer.data:
            if not item["group_name"] or not item["job_type_name"]:
                continue

            if not item["job_type_name"].startswith("test-"):
                continue

            if int(item["group_status"]) == 1:  # ok
                result = "passed"
            elif int(item["group_status"]) == 2:  # testfailed
                result = "testfailed"
            else:
                # other: 3 (skipped), 10 (unsupported (i.e. crashed))
                # we don't want to count this at all
                continue

            # TODO: consider stripping out some types; mostly care about FBC vs Intermittent
            classification = item["failure_classification"]

            if item["job_type_name"] not in job_type_names:
                job_type_names.append(item["job_type_name"])
            if item["group_name"] not in summary:
                summary[item["group_name"]] = {}
            if item["job_type_name"] not in summary[item["group_name"]]:
                summary[item["group_name"]][item["job_type_name"]] = {}
            if result not in summary[item["group_name"]][item["job_type_name"]]:
                summary[item["group_name"]][item["job_type_name"]][result] = {}
            if classification not in summary[item["group_name"]][item["job_type_name"]][result]:
                summary[item["group_name"]][item["job_type_name"]][result][classification] = 0
            summary[item["group_name"]][item["job_type_name"]][result][classification] += item[
                "job_count"
            ]

        data = {"job_type_names": job_type_names, "manifests": []}
        for m in summary.keys():
            mdata = []
            for d in summary[m]:
                for r in summary[m][d]:
                    for c in summary[m][d][r]:
                        mdata.append([job_type_names.index(d), r, int(c), summary[m][d][r][c]])
            data["manifests"].append({m: mdata})

        return Response(data=data)
