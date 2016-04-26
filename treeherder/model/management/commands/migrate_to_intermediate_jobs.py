import time
from optparse import make_option

from django.core.management.base import BaseCommand
from django.db import transaction

from treeherder.model.derived import JobsModel
from treeherder.model.models import (Datasource,
                                     Job,
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
                    help='Wait specified interval between signature migrations',
                    type='float',
                    default=0.0))

    def handle(self, *args, **options):
        if options['project']:
            projects = options['project']
        else:
            projects = Datasource.objects.values_list('project', flat=True)

        for project in projects:
            print project
            try:
                repository = Repository.objects.get(name=project)
            except:
                continue
            with JobsModel(project) as jm:
                offset = 0
                limit = 500

                while True:
                    datasource_jobs = jm.get_job_list(offset, limit)
                    if not datasource_jobs:
                        break
                    existing_jobs = Job.objects.filter(
                        repository=repository,
                        project_specific_id__in=[datasource_job['id'] for
                                                 datasource_job in datasource_jobs])
                    if len(existing_jobs) < len(datasource_jobs):
                        # only even bother trying to create new jobs if they
                        # haven't been created already
                        for datasource_job in datasource_jobs:
                            Job.objects.get_or_create(
                                repository=repository,
                                guid=datasource_job['job_guid'],
                                project_specific_id=datasource_job['id'])
                    offset += limit
                    time.sleep(options['interval'])
