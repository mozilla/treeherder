import datetime
import logging
import re

from django.db.models import Count
from django.db.models import Case, Value, When
from rest_framework import generics
from rest_framework.response import Response

from treeherder.model.models import JobLog
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
        if 'startdate' in request.query_params:
            startdate = request.query_params['startdate']

        if not startdate or not re.match(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}$', startdate):
            startdate = datetime.datetime.today()
        else:
            startdate = datetime.datetime.strptime(startdate, "%Y-%m-%d")

        if 'enddate' in request.query_params:
            enddate = request.query_params['enddate']

        if not enddate or not re.match(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}$', enddate):
            enddate = startdate + datetime.timedelta(days=1)
        else:
            enddate = datetime.datetime.strptime(enddate, "%Y-%m-%d")

        if (enddate - startdate).days > 1:
            enddate = startdate + datetime.timedelta(days=1)

        self.queryset = (
            JobLog.objects.filter(
                job__push__time__gte=str(startdate.date()), job__push__time__lte=str(enddate.date())
            )
            .values('job_id')
            .filter(
                job__repository_id__in=(1, 77),
                job__job_type__name__startswith='test-',
                groups__name__isnull=False,
                group_result__status__in=(1, 2),
            )
            .annotate(
                job_count=Count('job_id'),
                result=Case(
                    When(group_result__status=1, then=Value("passed")),
                    When(group_result__status=2, then=Value("testfailed")),
                ),
            )
            .values(
                'job_count',
                'job__job_type__name',
                'job__failure_classification_id',
                'groups__name',
                'result',
            )
            .order_by('groups__name')
        )

        serializer = self.get_serializer(self.queryset, many=True)

        summary = {}
        job_type_names = []
        for item in serializer.data:
            # TODO: consider stripping out some types; mostly care about FBC vs Intermittent
            classification = item['failure_classification']
            result = item["result"]

            if item['job_type_name'] not in job_type_names:
                job_type_names.append(item['job_type_name'])
            if item['group_name'] not in summary:
                summary[item['group_name']] = {}
            if item['job_type_name'] not in summary[item['group_name']]:
                summary[item['group_name']][item['job_type_name']] = {}
            if result not in summary[item['group_name']][item['job_type_name']]:
                summary[item['group_name']][item['job_type_name']][result] = {}
            if classification not in summary[item['group_name']][item['job_type_name']][result]:
                summary[item['group_name']][item['job_type_name']][result][classification] = 0
            summary[item['group_name']][item['job_type_name']][result][classification] += item[
                'job_count'
            ]

        data = {'job_type_names': job_type_names, 'manifests': []}
        for m in summary.keys():
            mdata = []
            for d in summary[m]:
                for r in summary[m][d]:
                    for c in summary[m][d][r]:
                        mdata.append([job_type_names.index(d), r, int(c), summary[m][d][r][c]])
            data['manifests'].append({m: mdata})

        return Response(data=data)
