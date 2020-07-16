from collections import defaultdict

from django.db.models import Count
from django.db.models.functions import TruncDate
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST

from treeherder.model.models import BugJobMap, Job, OptionCollection, Push, TextLogError
from treeherder.webapp.api.serializers import (
    FailureCountSerializer,
    FailuresByBugSerializer,
    FailuresQueryParamsSerializer,
    FailuresSerializer,
)
from treeherder.webapp.api.utils import get_end_of_day


class Failures(generics.ListAPIView):
    """ List of intermittent failures by date range and repo (project name) """

    serializer_class = FailuresSerializer
    queryset = None

    def list(self, request):
        query_params = FailuresQueryParamsSerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        startday = query_params.validated_data['startday']
        endday = get_end_of_day(query_params.validated_data['endday'])
        repo = query_params.validated_data['tree']

        self.queryset = (
            BugJobMap.failures.by_date(startday, endday)
            .by_repo(repo)
            .values('bug_id')
            .annotate(bug_count=Count('job_id'))
            .values('bug_id', 'bug_count')
            .order_by('-bug_count')
        )

        serializer = self.get_serializer(self.queryset, many=True)
        return Response(data=serializer.data)


class FailuresByBug(generics.ListAPIView):
    """ List of intermittent failure job details by bug, date range and repo (project name) """

    serializer_class = FailuresByBugSerializer
    queryset = None

    def list(self, request):
        query_params = FailuresQueryParamsSerializer(
            data=request.query_params, context='requireBug'
        )
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        startday = query_params.validated_data['startday']
        endday = get_end_of_day(query_params.validated_data['endday'])
        repo = query_params.validated_data['tree']
        bug_id = query_params.validated_data['bug']

        self.queryset = (
            BugJobMap.failures.by_date(startday, endday)
            .by_repo(repo)
            .by_bug(bug_id)
            .values(
                'job__repository__name',
                'job__machine_platform__platform',
                'bug_id',
                'job_id',
                'job__push__time',
                'job__push__revision',
                'job__signature__job_type_name',
                'job__option_collection_hash',
                'job__machine__name',
            )
            .order_by('-job__push__time')
        )

        lines = TextLogError.objects.filter(
            step__job_id__in=self.queryset.values_list('job_id', flat=True),
            line__contains='TEST-UNEXPECTED-FAIL',
        ).values_list('step__job_id', 'line')

        grouped_lines = defaultdict(list)
        for job_id, line in lines:
            if line is not None:
                grouped_lines[job_id].append(line)

        hash_list = set()

        for item in self.queryset:
            item['lines'] = grouped_lines.get(item['job_id'], [])
            hash_list.add(item['job__option_collection_hash'])

        hash_query = (
            OptionCollection.objects.filter(option_collection_hash__in=hash_list)
            .select_related('option')
            .values('option__name', 'option_collection_hash')
        )

        for item in self.queryset:
            match = [
                x['option__name']
                for x in hash_query
                if x['option_collection_hash'] == item['job__option_collection_hash']
            ]
            if match:
                item['build_type'] = match[0]
            else:
                item['build_type'] = 'unknown'

        serializer = self.get_serializer(self.queryset, many=True)
        return Response(data=serializer.data)


class FailureCount(generics.ListAPIView):
    """ List of failures (optionally by bug) and testruns by day per date range and repo"""

    serializer_class = FailureCountSerializer
    queryset = None

    def list(self, request):
        query_params = FailuresQueryParamsSerializer(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        startday = query_params.validated_data['startday']
        endday = get_end_of_day(query_params.validated_data['endday'])
        repo = query_params.validated_data['tree']
        bug_id = query_params.validated_data['bug']

        push_query = (
            Push.failures.filter(time__range=(startday, endday))
            .by_repo(repo, False)
            .annotate(date=TruncDate('time'))
            .values('date')
            .annotate(test_runs=Count('author'))
            .values('date', 'test_runs')
        )

        if bug_id:
            job_query = (
                BugJobMap.failures.by_date(startday, endday)
                .by_repo(repo)
                .by_bug(bug_id)
                .annotate(date=TruncDate('job__push__time'))
                .values('date')
                .annotate(failure_count=Count('id'))
                .values('date', 'failure_count')
            )
        else:
            job_query = (
                Job.failures.filter(
                    push__time__range=(startday, endday), failure_classification_id=4
                )
                .by_repo(repo, False)
                .select_related('push')
                .annotate(date=TruncDate('push__time'))
                .values('date')
                .annotate(failure_count=Count('id'))
                .values('date', 'failure_count')
            )

        # merges the push_query and job_query results into a list; if a date is found in both queries,
        # update the job_query with the test_run count, if a date is in push_query but not job_query,
        # add a new object with push_query data and a default for failure_count
        self.queryset = []
        for push in push_query:
            match = [job for job in job_query if push['date'] == job['date']]
            if match:
                match[0]['test_runs'] = push['test_runs']
                self.queryset.append(match[0])
            else:
                self.queryset.append(
                    {'date': push['date'], 'test_runs': push['test_runs'], 'failure_count': 0}
                )

        serializer = self.get_serializer(self.queryset, many=True)
        return Response(serializer.data)
