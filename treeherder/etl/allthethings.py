from django.conf import settings
import collections
import logging

from treeherder.etl.mixins import JsonExtractorMixin
from treeherder.etl.buildbot import get_symbols_and_platforms
from treeherder.model.derived.jobs import JobsModel
from treeherder.model.models import Repository


logger = logging.getLogger(__name__)


class AllthethingsTransformerMixin:

    def transform(self, extracted_content):
        logger.info('About to import allthethings.json builder data.')

        jobs_per_branch = collections.defaultdict(list)

        for builder, content in extracted_content['builders'].iteritems():
            job = get_symbols_and_platforms(builder)

            branch = content['properties']['branch']
            job.update({'branch': branch})
            jobs_per_branch[branch].append(job)

        return jobs_per_branch


class RunnableJobsProcess(JsonExtractorMixin,
                          AllthethingsTransformerMixin):

    def load(self, jobs_per_branch):
        active_projects = Repository.objects.filter(
            active_status='active').values_list('name', flat=True)

        # We clean the runnable_job table on every active repository
        # to avoid keeping old data when a branch moves away from
        # Buildbot
        for project in active_projects:
            with JobsModel(project) as jm:
                jm.clean_runnable_job_data()

        for project, data in jobs_per_branch.iteritems():
            # There are some branches in allthethings.json, e.g,
            # release/mozilla-beta that do not correspond to any
            # active project, we need to skip those
            if project not in active_projects:
                continue

            with JobsModel(project) as jm:
                jm.store_runnable_job_data(data)

    def run(self):
        extracted_content = self.extract(settings.ALLTHETHINGS_URL)
        jobs_per_branch = self.transform(extracted_content)
        self.load(jobs_per_branch)

        return True
