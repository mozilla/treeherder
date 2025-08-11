import datetime
import logging
import re

from django.db import connection
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

        # Optimize query:
        # 1. Filter job_type__name at database level to reduce data transfer
        # 2. Use select_related to reduce number of queries
        # 3. Only fetch relevant status values (1=OK, 2=ERROR)
        q = (
            Job.objects.filter(
                push__time__range=(startdate.date(), enddate.date()),
                repository_id__in=(1, 77),
                job_type__name__startswith="test-",  # Filter at DB level
                job_log__group_result__status__in=[1, 2],  # Only OK and ERROR statuses
            )
            .select_related("job_type", "failure_classification")  # Reduce queries
            .values(
                "job_log__groups__name",
                "job_type__name",
                "job_log__group_result__status",
                "failure_classification_id",
            )
            .annotate(job_count=Count("id"))
            .order_by("job_log__groups__name")
        )

        # Use iterator for large result sets to reduce memory usage
        summary = {}
        job_type_names = []

        # Process results directly without serializer overhead
        for item in q.iterator(chunk_size=2000):
            group_name = item["job_log__groups__name"]
            job_type_name = item["job_type__name"]
            group_status = item["job_log__group_result__status"]
            classification = item["failure_classification_id"]
            job_count = item["job_count"]

            if not group_name or not job_type_name:
                continue

            # Map status to result string
            result = "passed" if group_status == 1 else "testfailed"

            # Build summary structure
            if job_type_name not in job_type_names:
                job_type_names.append(job_type_name)
            if group_name not in summary:
                summary[group_name] = {}
            if job_type_name not in summary[group_name]:
                summary[group_name][job_type_name] = {}
            if result not in summary[group_name][job_type_name]:
                summary[group_name][job_type_name][result] = {}
            if classification not in summary[group_name][job_type_name][result]:
                summary[group_name][job_type_name][result][classification] = 0
            summary[group_name][job_type_name][result][classification] += job_count

        data = {"job_type_names": job_type_names, "manifests": []}
        for m in summary.keys():
            mdata = []
            for d in summary[m]:
                for r in summary[m][d]:
                    for c in summary[m][d][r]:
                        mdata.append([job_type_names.index(d), r, int(c), summary[m][d][r][c]])
            data["manifests"].append({m: mdata})

        return Response(data=data)

    def list_optimized_raw(self, request):
        """
        Alternative implementation using raw SQL for maximum performance.
        This can be used if the ORM version is still too slow.
        """
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

        # Raw SQL query optimized for performance
        query = """
            SELECT
                g.name as group_name,
                jt.name as job_type_name,
                gs.status as group_status,
                j.failure_classification_id,
                COUNT(j.id) as job_count
            FROM job j
            INNER JOIN push p ON j.push_id = p.id
            INNER JOIN job_type jt ON j.job_type_id = jt.id
            INNER JOIN job_log jl ON jl.job_id = j.id
            INNER JOIN group_status gs ON gs.job_log_id = jl.id
            INNER JOIN `group` g ON gs.group_id = g.id
            WHERE
                p.time >= %s AND p.time < %s
                AND j.repository_id IN (1, 77)
                AND jt.name LIKE 'test-%%'
                AND gs.status IN (1, 2)
            GROUP BY
                g.name,
                jt.name,
                gs.status,
                j.failure_classification_id
            ORDER BY
                g.name
        """

        with connection.cursor() as cursor:
            cursor.execute(query, [startdate.date(), enddate.date()])
            columns = [col[0] for col in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]

        # Process results
        summary = {}
        job_type_names = []

        for item in results:
            group_name = item["group_name"]
            job_type_name = item["job_type_name"]
            group_status = item["group_status"]
            classification = item["failure_classification_id"]
            job_count = item["job_count"]

            if not group_name or not job_type_name:
                continue

            result = "passed" if group_status == 1 else "testfailed"

            if job_type_name not in job_type_names:
                job_type_names.append(job_type_name)
            if group_name not in summary:
                summary[group_name] = {}
            if job_type_name not in summary[group_name]:
                summary[group_name][job_type_name] = {}
            if result not in summary[group_name][job_type_name]:
                summary[group_name][job_type_name][result] = {}
            if classification not in summary[group_name][job_type_name][result]:
                summary[group_name][job_type_name][result][classification] = 0
            summary[group_name][job_type_name][result][classification] += job_count

        data = {"job_type_names": job_type_names, "manifests": []}
        for m in summary.keys():
            mdata = []
            for d in summary[m]:
                for r in summary[m][d]:
                    for c in summary[m][d][r]:
                        mdata.append([job_type_names.index(d), r, int(c), summary[m][d][r][c]])
            data["manifests"].append({m: mdata})

        return Response(data=data)
