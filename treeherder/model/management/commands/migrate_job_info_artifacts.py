import sys
import time
from optparse import make_option

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
                    help='Wait specified number of seconds between job info migrations',
                    type='float',
                    default=0.0))

    def handle(self, *args, **options):
        if options['project']:
            datasources = Datasource.objects.filter(
                project__in=options['project'])
        else:
            datasources = Datasource.objects.all()
        for ds in datasources:
            self.stdout.write('{}\n'.format(ds.project))

            repository = Repository.objects.get(name=ds.project)
            offset = 0
            limit = 10000
            while True:
                job_ids = set(Job.objects.order_by(
                    'project_specific_id').filter(
                        project_specific_id__gt=offset,
                        repository=repository).values_list(
                            'project_specific_id', flat=True)[:limit])
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
                        am.DEBUG = False
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
                self.stdout.write('{} '.format(offset))
                sys.stdout.flush()
                offset = max_job_id
                time.sleep(options['interval'])
        self.stdout.write("\n")
