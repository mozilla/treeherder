from datetime import datetime
from optparse import make_option

from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from treeherder.model.derived.jobs import JobsModel
from treeherder.model.models import Datasource
from treeherder.model.models import (MachinePlatform, OptionCollection,
                                     Repository)
from treeherder.perf.models import (PerformanceFramework,
                                    PerformanceSignature,
                                    PerformanceDatum)

MAX_INTERVAL = 31536000


def _migrate_series(project_name, signature_hash, signature_props):
    framework = PerformanceFramework.objects.get(name='talos')
    repository = Repository.objects.get(name=project_name)

    with JobsModel(project_name) as jm:
        try:
            option_collection = OptionCollection.objects.get(
                option_collection_hash=signature_props['option_collection_hash'])
        except OptionCollection.DoesNotExist:
            print "Option collection for {} ({}) does not exist".format(
                signature_hash, signature_props)
            raise

        try:
            # can't use "get" for platform because we currently have more than one platform
            # with the same name in the database
            platform = MachinePlatform.objects.filter(
                platform=signature_props['machine_platform'])[0]
        except:
            raise "Platform or object collection for %s (%s) does not exist" % (
                signature_hash, signature_props)

        extra_properties = {}
        for k in signature_props.keys():
            if k not in ['option_collection_hash', 'machine_platform',
                         'test', 'suite']:
                extra_properties[k] = signature_props[k]

        with transaction.atomic():
            signature, _ = PerformanceSignature.objects.get_or_create(
                signature_hash=signature_hash,
                defaults={
                    'test': signature_props.get('test', ''),
                    'suite': signature_props['suite'],
                    'option_collection': option_collection,
                    'platform': platform,
                    'framework': framework,
                    'extra_properties': extra_properties
                })
            existing_job_ids = dict(map(
                lambda p: (p, 1),
                PerformanceDatum.objects.filter(
                    repository=repository,
                    signature=signature).values_list('job_id',
                                                     flat=True)))
            series_list = jm.get_performance_series_from_signatures(
                [signature_hash], MAX_INTERVAL)
            series = series_list[0]['blob']
            new_series = []
            for datum in series:
                value = datum.get('geomean',
                                  datum.get('value',
                                            datum.get('median',
                                                      datum.get('mean'))))
                if value is None:
                    print "WARNING: datum with no value: {}".format(datum)
                    continue
                if existing_job_ids.get(datum['job_id']):
                    # already inserted or an old duplicate, skip it
                    continue

                existing_job_ids[datum['job_id']] = 1
                new_series.append(PerformanceDatum(
                    repository=repository,
                    result_set_id=datum['result_set_id'],
                    job_id=datum['job_id'],
                    signature=signature,
                    value=value,
                    push_timestamp=datetime.fromtimestamp(datum['push_timestamp'])))

            PerformanceDatum.objects.bulk_create(new_series)


class Command(BaseCommand):

    help = "Migrate old per-project treeherder database data"

    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='store',
                    help='Only merge data on specified project (defaults to all)'),
    )

    def handle(self, *args, **options):

        # debug must be set to false, given the quantity of date we're ingesting
        # here -- we'll oom otherwise
        settings.DEBUG = False

        if options['project']:
            project_names = [options['project']]
        else:
            project_names = Datasource.objects.values_list(
                'project', flat=True).distinct()

        for project_name in project_names:
            with JobsModel(project_name) as jm:
                summary = jm.get_performance_series_summary(MAX_INTERVAL)
                for (signature_hash, signature_props) in summary.iteritems():
                    _migrate_series(project_name, signature_hash,
                                    signature_props)
