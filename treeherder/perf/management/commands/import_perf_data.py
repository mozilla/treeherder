import collections
import datetime
import math
from multiprocessing import Manager as interproc
from multiprocessing import Process

from django.core.management.base import BaseCommand
from django.db import connections

from treeherder.model.models import (
    BuildPlatform,
    FailureClassification,
    Job,
    JobGroup,
    JobType,
    Machine,
    MachinePlatform,
    Option,
    OptionCollection,
    Product,
    Push,
    ReferenceDataSignatures,
    Repository,
    RepositoryGroup,
)
from treeherder.perf.models import (
    BackfillRecord,
    BackfillReport,
    IssueTracker,
    PerformanceAlert,
    PerformanceAlertSummary,
    PerformanceDatum,
    PerformanceFramework,
    PerformanceSignature,
)

LOG_EVERY = 5  # seconds


def occasional_log(message, seconds=LOG_EVERY):
    now = datetime.datetime.now()
    if now.second % seconds == 0:
        print(message)


def progress_notifier(
    item_processor, iterable: list, item_name: str, tabs_no=0,
):
    total_items = len(iterable)
    print('{0}Fetching {1} {2} item(s)...'.format('\t' * tabs_no, total_items, item_name))

    prev_percentage = None
    for idx, item in enumerate(iterable):
        item_processor(item)
        percentage = int((idx + 1) * 100 / total_items)
        if percentage % 10 == 0 and percentage != prev_percentage:
            print('{0}Fetched {1}% of {2} item(s)'.format('\t' * tabs_no, percentage, item_name))
            prev_percentage = percentage


def _ignore_classifier(table_name, model):
    model.classifier = None


def _ignore_assignee(table_name, model):
    model.assignee = None


SENSITIVE_TABLES_MAP = {
    'performance_alert': _ignore_classifier,
    'performance_alert_summary': _ignore_assignee,
}


class Data:
    def __init__(self, source, target, progress_notifier=None, **kwargs):
        self.source = source
        self.target = target
        self.progress_notifier = progress_notifier

    def fillup_target(self, **filters):
        pass

    def show_progress(self, queryset, map, table_name):
        total_rows = int(queryset.count())
        print('Fetching {0} {1}(s)...'.format(total_rows, table_name))

        prev_percentage = None
        for idx, obj in enumerate(list(queryset)):
            map(obj)
            percentage = int((idx + 1) * 100 / total_rows)
            if percentage % 10 == 0 and percentage != prev_percentage:
                print('Fetched {0}% of alert summaries'.format(percentage))
                prev_percentage = percentage


class DecentSizedData(Data):
    DECENT_SIZED_TABLES = [
        FailureClassification,
        PerformanceFramework,
        RepositoryGroup,
        Repository,
        IssueTracker,
        Option,
        OptionCollection,
        MachinePlatform,
        Product,
    ]

    def delete_local_data(self):
        for model in self.DECENT_SIZED_TABLES:
            print('Removing elements from {0} table... '.format(model._meta.db_table))
            model.objects.using(self.target).all().delete()

    def save_local_data(self):
        for model in self.DECENT_SIZED_TABLES:
            print('Fetching from {0} table...'.format(model._meta.db_table))
            model.objects.using(self.target).bulk_create(model.objects.using(self.source).all())

    def fillup_target(self, **filters):
        print('Fetching all affordable data...\n')
        # TODO: JSON dump the list
        print(
            'From tables {0}'.format(
                ', '.join([model._meta.db_table for model in self.DECENT_SIZED_TABLES])
            )
        )

        self.delete_local_data()
        self.save_local_data()


class MassiveData(Data):
    BIG_SIZED_TABLES = [
        BackfillReport,
        BackfillRecord,
        PerformanceAlertSummary,
        PerformanceAlert,
        ReferenceDataSignatures,
        PerformanceDatum,
        PerformanceSignature,
        Job,
        JobGroup,
        JobType,
        Push,
        BuildPlatform,
        Machine,
    ]

    priority_dict = {
        'reference_data_signature': {'download_order': 1, 'model': ReferenceDataSignatures},
        'push': {'download_order': 1, 'model': Push},
        'build_platform': {'download_order': 1, 'model': BuildPlatform},
        'machine': {'download_order': 1, 'model': Machine},
        'job_group': {'download_order': 1, 'model': JobGroup},
        'job_type': {'download_order': 1, 'model': JobType},
        'performance_signature': {'download_order': 2, 'model': PerformanceSignature},
        'job': {'download_order': 2, 'model': Job},
        'performance_alert_summary': {'download_order': 2, 'model': PerformanceAlertSummary},
        'performance_datum': {'download_order': 3, 'model': PerformanceDatum},
        'performance_alert': {'download_order': 3, 'model': PerformanceAlert},
        'backfill_report': {'download_order': 3, 'model': BackfillReport},
        'backfill_record': {'download_order': 4, 'model': BackfillRecord},
    }

    def __init__(
        self,
        source,
        target,
        num_workers,
        frameworks,
        repositories,
        time_window,
        progress_notifier=None,
        **kwargs,
    ):

        super().__init__(source, target, progress_notifier, **kwargs)
        self.time_window = time_window
        self.num_workers = num_workers

        oldest_day = datetime.datetime.now() - self.time_window
        self.query_set = (
            PerformanceAlertSummary.objects.using(self.source)
            .select_related('framework', 'repository')
            .filter(created__gte=oldest_day)
        )

        if frameworks:
            self.query_set = self.query_set.filter(framework__name__in=frameworks)
        if repositories:
            self.query_set = self.query_set.filter(repository__name__in=repositories)

        self.frameworks = (
            frameworks
            if frameworks is not None
            else list(
                PerformanceFramework.objects.using(self.source).values_list('name', flat=True)
            )
        )
        self.repositories = (
            repositories
            if repositories is not None
            else list(Repository.objects.using(self.source).values_list('name', flat=True))
        )
        interproc_instance = interproc()
        self.models_instances = {
            'reference_data_signature': interproc_instance.list(),
            'performance_alert': interproc_instance.list(),
            'job': interproc_instance.list(),
            'job_type': interproc_instance.list(),
            'job_group': interproc_instance.list(),
            'performance_datum': interproc_instance.list(),
            'performance_alert_summary': interproc_instance.list(),
            'push': interproc_instance.list(),
            'build_platform': interproc_instance.list(),
            'machine': interproc_instance.list(),
            'performance_signature': interproc_instance.list(),
            'backfill_report': interproc_instance.list(),
            'backfill_record': interproc_instance.list(),
        }

    def delete_local_data(self):
        for model in self.BIG_SIZED_TABLES:
            print('Removing elements from {0} table... '.format(model._meta.db_table))
            model.objects.using(self.target).all().delete()

    def save_local_data(self):
        priority_dict = collections.OrderedDict(
            sorted(self.priority_dict.items(), key=lambda item: item[1]['download_order'])
        )

        for table_name, properties in priority_dict.items():
            print('Saving {0} data...'.format(table_name))
            model_values = (
                properties['model']
                .objects.using(self.source)
                .filter(pk__in=self.models_instances[table_name])
            )
            self._ignore_sensitive_fields(table_name, model_values)
            properties['model'].objects.using(self.target).bulk_create(model_values)

    def _ignore_sensitive_fields(self, table_name, model_values):
        """
        UPSTREAM_DATABASE_URL credentials don't generally have read rights on
        the auth_user table (which contains users' password hashes).
        Simply setting `model.sensitive_field = None` won't cause access errors.
        """
        ignore_sensitive_fields = SENSITIVE_TABLES_MAP.get(table_name)
        if ignore_sensitive_fields is not None:
            for model in model_values:
                ignore_sensitive_fields(table_name, model)

    def fillup_target(self, **filters):
        # fetch all alert summaries & alerts
        # with only a subset of the datum & jobs
        oldest_day = datetime.datetime.now() - self.time_window
        print('\nFetching data subset no older than {0}...'.format(str(oldest_day)))

        self.delete_local_data()
        alert_summaries = list(self.query_set)
        alert_summaries_len = len(alert_summaries)

        # close all database connections
        # new connections will be automatically opened in processes
        connections.close_all()

        processes_list = []
        num_workers = min(self.num_workers, alert_summaries_len)
        try:
            stop_idx = step_size = math.ceil(alert_summaries_len / num_workers)
        except ZeroDivisionError:
            raise RuntimeError('No alert summaries to fetch.')

        start_idx = 0
        for idx in range(num_workers):
            alerts = alert_summaries[start_idx:stop_idx]
            p = Process(target=self.db_worker, args=(idx + 1, alerts))
            processes_list.append(p)

            start_idx, stop_idx = stop_idx, stop_idx + step_size

        # start the processes
        for p in processes_list:
            p.start()

        # start the processes
        for p in processes_list:
            p.join()

        self.save_local_data()

    def db_worker(self, process_no, alert_summaries):
        print('Process no {0} up and running...'.format(process_no))
        self.progress_notifier(self.bring_in_alert_summary, alert_summaries, 'alert summary', 1)

    def bring_in_alert_summary(self, alert_summary):
        self.update_list('push', alert_summary.push)
        self.update_list('push', alert_summary.prev_push)
        self.update_list('performance_alert_summary', alert_summary)
        self.update_list('backfill_report', alert_summary)
        # bring in all its alerts
        alerts = list(
            PerformanceAlert.objects.using(self.source)
            .select_related('series_signature')
            .filter(summary=alert_summary)
        )

        self.progress_notifier(self.bring_in_alert, alerts, 'alert', 2)

    def bring_in_alert(self, alert):

        if alert.id in self.models_instances['performance_alert']:
            return

        print('{0}Fetching alert #{1}...'.format('\t' * 2, alert.id))
        if alert.related_summary:
            if alert.related_summary not in self.models_instances['performance_alert_summary']:
                # if the alert summary identified isn't registered yet
                # register it with all its alerts
                self.progress_notifier(
                    self.bring_in_alert_summary, [alert.related_summary], 'alert summary', 1
                )

        # pull parent signature first
        parent_signature = alert.series_signature.parent_signature
        if parent_signature:
            self.bring_in_performance_data(alert.created, parent_signature)
            self.update_list('performance_signature', parent_signature)

        # then signature itself
        self.bring_in_performance_data(alert.created, alert.series_signature)
        self.update_list('performance_signature', alert.series_signature)

        # then alert itself
        # we don't have access to user table...
        alert.classifier = None
        self.models_instances['performance_alert'].append(alert.id)
        self.models_instances['backfill_record'].append(alert.id)

    def bring_in_performance_data(self, time_of_alert, performance_signature):
        performance_data = list(
            PerformanceDatum.objects.using(self.source).filter(
                repository=performance_signature.repository,
                signature=performance_signature,
                push_timestamp__gte=(time_of_alert - self.time_window),
            )
        )

        self.progress_notifier(
            self.bring_in_performance_datum, performance_data, 'performance datum', 3
        )

    def bring_in_performance_datum(self, performance_datum):
        if performance_datum.id in self.models_instances['performance_datum']:
            return

        self.update_list('push', performance_datum.push)

        self.bring_in_job(performance_datum.job)
        self.models_instances['performance_datum'].append(performance_datum.id)

    def bring_in_job(self, job):
        if job.id in self.models_instances['job']:
            return

        occasional_log('{0}Fetching job #{1}'.format('\t' * 4, job.id))

        self.update_list('reference_data_signature', job.signature)
        self.update_list('build_platform', job.build_platform)
        self.update_list('machine', job.machine)
        self.update_list('job_group', job.job_group)
        self.update_list('job_type', job.job_type)
        self.update_list('push', job.push)

        self.models_instances['job'].append(job.id)

    def update_list(self, database_key, element):
        if element.id in self.models_instances[database_key]:
            return
        self.models_instances[database_key].append(element.id)


class Command(BaseCommand):
    help = "Pre-populate performance data from an external source"

    def add_arguments(self, parser):
        parser.add_argument(
            '--num-workers', action='store', dest='num_workers', type=int, default=4
        )

        parser.add_argument('--time-window', action='store', type=int, default=1)

        parser.add_argument('--frameworks', nargs='+', default=None)

        parser.add_argument('--repositories', nargs='+', default=None)

    def handle(self, *args, **options):

        time_window = datetime.timedelta(days=options['time_window'])
        num_workers = options['num_workers']
        frameworks = options['frameworks']
        repositories = options['repositories']

        affordable_data = DecentSizedData(source='upstream', target='default')
        subseted_data = MassiveData(
            source='upstream',
            target='default',
            progress_notifier=progress_notifier,
            time_window=time_window,
            num_workers=num_workers,
            frameworks=frameworks,
            repositories=repositories,
        )

        affordable_data.fillup_target()
        subseted_data.fillup_target(last_n_days=time_window)
