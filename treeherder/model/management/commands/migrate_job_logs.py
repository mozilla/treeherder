import MySQLdb
from django.conf import settings
from django.core.management.base import BaseCommand

from treeherder.model.models import (Datasource,
                                     Job,
                                     JobLog,
                                     Repository)


class Command(BaseCommand):

    help = 'Migrate existing project-specific job logs to master database'

    def handle(self, *args, **options):

        for ds in Datasource.objects.all():
            self.stdout.write('{}\n'.format(ds.project))
            try:
                repository = Repository.objects.get(name=ds.project)
            except Repository.DoesNotExist:
                self.stderr.write('No repository for datasource project {}, skipping\n'.format(
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
            limit = 10000
            migrated_keys = {}
            while True:
                job_id_pairs = Job.objects.filter(
                    id__gt=offset,
                    repository=repository).values_list(
                        'id', 'project_specific_id')[:limit]

                if len(job_id_pairs) == 0:
                    break
                job_ids = set([job_id_pair[1] for job_id_pair in job_id_pairs])
                # filter out those job ids for which we already have
                # generated job details
                job_ids -= set(JobLog.objects.filter(
                    job__repository=repository,
                    job__project_specific_id__in=job_ids).values_list(
                        'job__project_specific_id', flat=True))

                if job_ids:
                    job_id_mapping = dict((project_specific_id, job_id) for
                                          (job_id, project_specific_id) in
                                          job_id_pairs)
                    c.execute("""SELECT job_id, name, url, parse_status from job_log_url where job_id in {}""".format(tuple([int(job_id) for job_id in job_ids])))
                    job_logs = []
                    datasource_job_logs = c.fetchall()
                    for (job_id, name, url, parse_status) in datasource_job_logs:
                        if migrated_keys.get((job_id, name, url)):
                            continue
                        migrated_keys[(job_id, name, url)] = 1
                        if parse_status == 'parsed':
                            migrated_parse_status = JobLog.PARSED
                        elif parse_status == 'failed':
                            migrated_parse_status = JobLog.FAILED
                        else:
                            migrated_parse_status = JobLog.PENDING
                        job_logs.append(JobLog(
                            job_id=job_id_mapping[job_id],
                            name=name,
                            url=url,
                            status=migrated_parse_status))
                    JobLog.objects.bulk_create(job_logs)
                    self.stdout.write('{} '.format(offset))
                    self.stdout.flush()
                offset = max([job_id_pair[0] for job_id_pair in job_id_pairs])
                self.stdout.write("\n")
