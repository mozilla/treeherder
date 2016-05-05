import sys
import time
from optparse import make_option

import MySQLdb
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from treeherder.model.derived import ArtifactsModel
from treeherder.model.models import (Datasource,
                                     Job,
                                     JobDetail,
                                     Repository)


class Command(BaseCommand):

    help = 'Migrate existing jobs to intermediate jobs table'
    option_list = BaseCommand.option_list + (
        make_option('--project',
                    action='append',
                    dest='project',
                    help='Filter deletion to particular project(s)',
                    type='string'),
        make_option('--interval',
                    dest='interval',
                    help='Wait specified interval between job info migrations',
                    type='float',
                    default=0.0))

    def handle(self, *args, **options):
        if options['project']:
            datasources = Datasource.objects.filter(
                project__in=options['project'])
        else:
            datasources = Datasource.objects.all()
        for ds in datasources:
            print ds.project
            db_options = settings.DATABASES['default'].get('OPTIONS', {})
            db = MySQLdb.connect(
                host=settings.DATABASES['default']['HOST'],
                db=settings.DATABASES['default']['NAME'],
                user=settings.DATABASES['default']['USER'],
                passwd=settings.DATABASES['default'].get('PASSWORD') or '',
                **db_options
            )

            repository = Repository.objects.get(name=ds.project)
            c = db.cursor()
            offset = 0
            limit = 10000
            while True:
                c.execute("""SELECT project_specific_id from job where project_specific_id>{} and repository_id={} limit 0,{}""".format(offset, repository.id, limit))
                job_ids = set([job_id[0] for job_id in c.fetchall()])
                if len(job_ids) == 0:
                    break
                max_job_id = max(job_ids)
                # filter out those job ids for which we already have
                # generated job details
                job_ids -= set(JobDetail.objects.filter(
                    job__repository=repository,
                    job__project_specific_id__in=job_ids).values_list(
                        'job__project_specific_id', flat=True))
                if job_ids:
                    with ArtifactsModel(ds.project) as am:
                        artifacts = am.get_job_artifact_list(0, 10000, {
                            'job_id': set([('IN', tuple(job_ids))]),
                            'name': set([("=", "Job Info")])})
                        with transaction.atomic():
                            for artifact in artifacts:
                                for job_detail_dict in artifact['blob']['job_details']:
                                    intermediate_job = Job.objects.get(
                                        repository=repository,
                                        project_specific_id=artifact['job_id'])
                                    JobDetail.objects.create(
                                        job=intermediate_job,
                                        title=job_detail_dict.get('title'),
                                        value=job_detail_dict['value'],
                                        url=job_detail_dict.get('url'))
                print offset,
                sys.stdout.flush()
                offset = max_job_id
                time.sleep(options['interval'])
            print "\n"
