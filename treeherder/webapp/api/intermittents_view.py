from django.db.models import Count
from django.db.models.functions import TruncDate
from rest_framework import generics

from pagination import CustomPagePagination
from treeherder.model.models import (BugJobMap,
                                     Job,
                                     OptionCollection,
                                     Push)
from treeherder.webapp.api.utils import (get_end_of_day,
                                         get_repository)

from .serializers import (FailureCountSerializer,
                          FailuresByBugSerializer,
                          FailuresSerializer)


class Failures(generics.ListAPIView):
    """ List of intermittent failures by date range and repo (project name) """

    serializer_class = FailuresSerializer
    pagination_class = CustomPagePagination

    def get_queryset(self):
        startday = self.request.query_params.get('startday')
        endday = get_end_of_day(self.request.query_params.get('endday').encode('utf-8'))
        repo = list(get_repository(self.request.query_params.get('tree')))

        queryset = BugJobMap.objects.filter(job__repository_id__in=repo,
                                            job__push__time__range=(startday, endday),
                                            job__failure_classification__id=4
                                            ).select_related('push').values('bug_id').annotate(
                                            bug_count=Count('job_id')).values('bug_id', 'bug_count').order_by(
                                            '-bug_count')
        return queryset


class FailuresByBug(generics.ListAPIView):
    """ List of intermittent failure job details by bug, date range and repo (project name) """

    serializer_class = FailuresByBugSerializer
    pagination_class = CustomPagePagination

    def get_queryset(self):
        startday = self.request.query_params.get('startday')
        endday = get_end_of_day(self.request.query_params.get('endday').encode('utf-8'))
        repo = list(get_repository(self.request.query_params.get('tree')))
        bug_id = int(self.request.query_params.get('bug'))

        queryset = BugJobMap.objects.filter(bug_id=bug_id,
                                            job__repository_id__in=repo,
                                            job__push__time__range=(startday, endday)
                                            ).select_related('job', 'push').values(
                                            'bug_id', 'job_id', 'job__push__time', 'job__machine_platform__platform',
                                            'job__repository__name', 'job__push__revision',
                                            'job__signature__job_type_name', 'job__option_collection_hash',
                                             ).order_by('-job__push__time')

        hash_list = []

        for item in queryset:
            match = filter(lambda x: item['job__option_collection_hash'] == x, hash_list)
            if len(match) == 0:
                hash_list.append(item['job__option_collection_hash'])

        hash_query = OptionCollection.objects.filter(option_collection_hash__in=hash_list).select_related(
                                                     'option').values('option__name', 'option_collection_hash')

        for item in queryset:
            match = filter(lambda x: item['job__option_collection_hash'] == x['option_collection_hash'], hash_query)
            if len(match) > 0:
                item['build_type'] = match[0]['option__name']
            else:
                item['build_type'] = 'unknown'

        return queryset


class FailureCount(generics.ListAPIView):
    """ List of failures (optionally by bug) and testruns by day per date range and repo"""

    serializer_class = FailureCountSerializer

    def get_queryset(self):
        startday = self.request.query_params.get('startday')
        endday = get_end_of_day(self.request.query_params.get('endday').encode('utf-8'))
        repo = list(get_repository(self.request.query_params.get('tree')))
        bug_id = self.request.query_params.get('bug')

        push_query = Push.objects.filter(repository_id__in=repo,
                                         time__range=(startday, endday)).annotate(date=TruncDate('time')).values(
                                         'date').annotate(test_runs=Count('author')).order_by('date').values(
                                         'date', 'test_runs')

        if bug_id:
            job_query = BugJobMap.objects.filter(job__repository_id__in=repo,
                                                 job__push__time__range=(startday, endday),
                                                 job__failure_classification__id=4,
                                                 bug_id=int(bug_id)
                                                 ).select_related('push').annotate(date=TruncDate('job__push__time'))\
                                                 .values('date').annotate(failure_count=Count('id')).order_by(
                                                 'date').values('date', 'failure_count')
        else:
            job_query = Job.objects.filter(push__time__range=(startday, endday),
                                           repository_id__in=repo,
                                           failure_classification_id=4).select_related('push').annotate(
                                           date=TruncDate('push__time')).values('date').annotate(
                                           failure_count=Count('id')).order_by('date').values('date', 'failure_count')

        # merges the push_query and job_query results into a list; if a date is found in both queries,
        # update the job_query with the test_run count, if a date is in push_query but not job_query,
        # add a new object with push_query data and a default for failure_count
        queryset = []
        for push in push_query:
            match = filter(lambda x: push['date'] == x['date'], job_query)
            if len(match) > 0:
                match[0]['test_runs'] = push['test_runs']
                queryset.append(match[0])
            else:
                queryset.append({'date': push['date'], 'test_runs': push['test_runs'], 'failure_count': 0})

        return queryset
