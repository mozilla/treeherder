from datetime import datetime
from optparse import make_option

from concurrent.futures import ProcessPoolExecutor
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

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
        if not PerformanceSignature.objects.filter(
                signature_hash=signature_hash):
            try:
                option_collection = OptionCollection.objects.filter(
                    option_collection_hash=signature_props['option_collection_hash'])[0]
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

            signature, _ = PerformanceSignature.objects.get_or_create(
                signature_hash=signature_hash,
                test=signature_props.get('test', ''),
                suite=signature_props['suite'],
                option_collection=option_collection,
                platform=platform,
                framework=framework,
                extra_properties=extra_properties)

            series_list = jm.get_performance_series_from_signatures(
                [signature_hash], MAX_INTERVAL)
            series = series_list[0]['blob']
            new_series = []
            for datum in series:
                perfdatum = {}
                for k in datum.keys():
                    if k not in ['result_set_id', 'job_id', 'push_timestamp']:
                        perfdatum[k] = datum[k]

                new_series.append(PerformanceDatum(
                    repository=repository,
                    result_set_id=datum['result_set_id'],
                    job_id=datum['job_id'],
                    signature=signature,
                    datum=perfdatum,
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
                with ProcessPoolExecutor() as executor:
                    futures = []

                    summary = jm.get_performance_series_summary(MAX_INTERVAL)
                    for (signature_hash, signature_props) in summary.iteritems():
                        futures.append(executor.submit(
                            _migrate_series, project_name, signature_hash,
                            signature_props))

                    for future in futures:
                        try:
                            future.result()
                        except Exception, e:
                            self.stderr.write("FAIL: {}".format(e))
                            # shutdown any pending tasks and exit (if something
                            # is in progress, no wait to stop it)
                            executor.shutdown(wait=False)
                            for future in futures:
                                future.cancel()
                            raise CommandError(
                                "Failed to migrate performance data: {}".format(e))
