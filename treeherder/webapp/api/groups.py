import datetime
import logging
import re

from django.db.models import Count
from django.db.models import Case, Value, When
from rest_framework import generics
from rest_framework.response import Response

from treeherder.model.models import JobLog
from collections import defaultdict

logger = logging.getLogger(__name__)


class SummaryByGroupName(generics.ListAPIView):
    """
    This yields group names/status summary for the given group and day.
    """

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
                group_result__status__in=(1, 2),
            )
            .exclude(
                groups__name='',
            )
            .annotate(
                job_count=Count('job_id'),
                result=Case(
                    When(group_result__status=1, then=Value("passed")),
                    When(group_result__status=2, then=Value("testfailed")),
                ),
            )
            .values_list(
                'groups__name',
                'job__job_type__name',
                'result',
                'job__failure_classification_id',
                'job_count',
            )
            .order_by('groups__name')
        )

        # Reference job types in a separated list
        job_type_names = set()
        # Group items by group name, type name, result and classification
        summary = defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(int))))
        for item in self.queryset.all():
            group_name, type_name, result, classification, job_count = item

            # Strip a possible number suffix
            name, suffix = type_name.rsplit('-', maxsplit=1)
            if suffix.isdigit():
                type_name = name

            job_type_names.add(type_name)
            summary[group_name][type_name][result][classification] += job_count

        # Cast job types as a list, to use their index as reference in manifests
        job_type_names = sorted(job_type_names)

        manifests = []
        for group, types in summary.items():
            mdata = []
            for t_name, results in types.items():
                for result, classifications in results.items():
                    for classif, job_count in classifications.items():
                        mdata.append(
                            [job_type_names.index(t_name), result, int(classif), job_count]
                        )
            manifests.append({group: mdata})

        return Response(
            data={
                'job_type_names': job_type_names,
                'manifests': manifests,
            }
        )
