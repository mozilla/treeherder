import time
import zlib
from optparse import make_option

import concurrent.futures
import MySQLdb
import simplejson as json
from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.model.models import (Datasource,
                                     Job,
                                     JobDetail,
                                     Repository)


class Command(BaseCommand):

    help = 'Migrate existing text log summary artifacts to main database'
    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='append',
                    dest='project',
                    help='Filter operation to particular project(s)',
                    type='string'),
        make_option('--batch',
                    dest='batch_size',
                    help='Number of artifacts to migrate in interval',
                    type='int',
                    default=10000),
        make_option('--interval',
                    dest='interval',
                    help='Wait specified interval between migrations',
                    type='float',
                    default=0.0))

    def handle(self, *args, **options):
        if options['project']:
            projects = options['project']
        else:
            projects = Datasource.objects.values_list('project', flat=True)

        for ds in Datasource.objects.filter(project__in=projects):
            print ds.project
            try:
                repository = Repository.objects.get(name=ds.project)
            except Repository.DoesNotExist:
                self.stderr.write('No repository for datasource project {}, skipping'.format(
                    ds.project))
                continue

            db_options = settings.DATABASES['default'].get('OPTIONS', {})
            db = MySQLdb.connect(
                host=settings.DATABASES['default']['HOST'],
                db=ds.name,
                user=settings.DATABASES['default']['USER'],
                passwd=settings.DATABASES['default'].get('PASSWORD') or '',
                **db_options
            )
            c = db.cursor()
            offset = 0
            limit = options['batch_size']

            while True:
                job_id_pairs = Job.objects.filter(
                    id__gt=offset,
                    repository=repository).values_list(
                        'id', 'project_specific_id')[:limit]
                if len(job_id_pairs) == 0:
                    break
                ds_job_ids = set([job_id_pair[1] for job_id_pair in job_id_pairs])
                # filter out those job ids for which we already have
                # generated job details
                ds_job_ids -= set(JobDetail.objects.filter(
                    title='buildbot_request_id',
                    job__repository=repository,
                    job__project_specific_id__in=ds_job_ids).values_list(
                        'job__project_specific_id', flat=True))
                start = time.time()
                if ds_job_ids:
                    job_id_mapping = dict((project_specific_id, job_id) for
                                          (job_id, project_specific_id) in
                                          job_id_pairs)
                    c.execute("""SELECT job_id, `blob` from job_artifact where `name` = 'buildapi' and job_id in ({})""".format(",".join([str(job_id) for job_id in ds_job_ids])))

                    def unwrap(row):
                        request_id = json.loads(zlib.decompress(row[1]))['request_id']
                        return (row[0], request_id)

                    request_id_details = []
                    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
                        for (ds_job_id, request_id) in executor.map(unwrap, c.fetchall()):
                            request_id_details.append(JobDetail(
                                job_id=job_id_mapping[ds_job_id],
                                title='buildbot_request_id',
                                value=str(request_id)))
                        JobDetail.objects.bulk_create(request_id_details)
                self.stdout.write('{} ({})'.format(offset, time.time() - start), ending='')
                self.stdout.flush()
                offset = max([job_id_pair[0] for job_id_pair in job_id_pairs])
            print '\n'
