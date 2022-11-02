import datetime
import logging
import re

from django.db.models import Count
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.model.models import (
    JobLog,
)
from treeherder.webapp.api.serializers import GroupNameSerializer

logger = logging.getLogger(__name__)


class SummaryByGroupName(generics.ListAPIView):
    """
    This yields group names/status summary for the given group and day.
    """

    serializer_class = GroupNameSerializer
    queryset = None

    def list(self, request):
        manifests = None
        if 'manifest' in request.query_params:
            manifests = [
                x.strip()
                for x in request.query_params['manifest'].split(',')
                if x and '/' in x.strip()
            ]

        if not manifests or len(manifests) == 0:
            if 'manifest' in request.query_params:
                error = (
                    "invalid url query parameter manifest: '%s'" % request.query_params['manifest']
                )
            else:
                error = "invalid url query parameter manifest: None"
            return Response(data=error, status=HTTP_400_BAD_REQUEST)

        date = None
        if 'date' in request.query_params:
            date = request.query_params['date']

        if not date or not re.match(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}$', date):
            date = str(datetime.datetime.today().date())

        date = datetime.datetime.strptime(date, "%Y-%m-%d")
        tomorrow = date + datetime.timedelta(days=1)

        self.queryset = (
            JobLog.objects.filter(job__push__time__range=(str(date.date()), str(tomorrow.date())))
            .filter(job__repository_id__in=(1, 77))
            .filter(groups__name__in=manifests)
            .values(
                'groups__name',
                'job__job_type__name',
                'job__result',
            )
            .annotate(job_count=Count('job_id'))
            .values('groups__name', 'job__job_type__name', 'job__result', 'job_count')
            .order_by('job__job_type__name')
        )
        serializer = self.get_serializer(self.queryset, many=True)
        summary = {}
        for item in serializer.data:
            if item['group_name'] not in summary:
                summary[item['group_name']] = {}
            if item['job_type_name'] not in summary[item['group_name']]:
                summary[item['group_name']][item['job_type_name']] = {}
            if item['job_result'] not in summary[item['group_name']][item['job_type_name']]:
                summary[item['group_name']][item['job_type_name']][item['job_result']] = 0
            summary[item['group_name']][item['job_type_name']][item['job_result']] += item[
                'job_count'
            ]

        data = []
        for m in manifests:
            mdata = []
            # print out manifest with no data
            if m not in summary:
                data.append({"manifest": m, "results": []})
                continue
            for d in summary[m]:
                for r in summary[m][d]:
                    mdata.append(
                        {"job_type_name": d, "job_result": r, "job_count": summary[m][d][r]}
                    )
            data.append({"manifest": m, "results": mdata})

        return Response(data=data)
