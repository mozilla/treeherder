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

        summary = {}
        job_type_names = {}
        job_type_counter = 0

        for platform in ["windows", "linux", "macosx", "android"]:
            q = (
                Job.objects.filter(
                    push__time__range=(startdate.date(), enddate.date()),
                    repository_id__in=(1, 77),
                    job_type__name__startswith=f"test-{platform}",  # Filter at DB level
                    job_log__group_result__status__in=(1, 2),  # Only OK and ERROR statuses
                )
                .select_related("job_type", "job_log")  # Reduce queries
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
            for item in serializer.data:
                group_name = item["group_name"]
                job_type_name = item["job_type_name"]
                group_status = int(item["group_status"])
                classification = item["failure_classification"]
                job_count = item["job_count"]

                if not group_name or not job_type_name:
                    continue

                # serialize job_type_name (remove chunk number)
                parts = job_type_name.split("-")
                try:
                    _ = int(parts[-1])
                    job_type_name = "-".join(parts[:-1])
                except ValueError:
                    pass

                result = "passed" if group_status == 1 else "testfailed"

                if job_type_name not in job_type_names:
                    job_type_names[job_type_name] = job_type_counter
                    jt_index = job_type_counter
                    job_type_counter += 1
                else:
                    jt_index = job_type_names[job_type_name]

                if group_name not in summary:
                    summary[group_name] = {}
                if jt_index not in summary[group_name]:
                    summary[group_name][jt_index] = {}
                if result not in summary[group_name][jt_index]:
                    summary[group_name][jt_index][result] = {}
                if classification not in summary[group_name][jt_index][result]:
                    summary[group_name][jt_index][result][classification] = 0
                summary[group_name][jt_index][result][classification] += job_count

        data = {"job_type_names": job_type_names.keys(), "manifests": []}
        for m in summary.keys():
            mdata = []
            for d in summary[m]:
                for r in summary[m][d]:
                    for c in summary[m][d][r]:
                        mdata.append([d, r, int(c), summary[m][d][r][c]])
            data["manifests"].append({m: mdata})

        return Response(data=data)
