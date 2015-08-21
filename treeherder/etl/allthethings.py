from django.conf import settings

from treeherder.client import TreeherderCollection, TreeherderPossibleJob
from treeherder.etl.mixins import JsonExtractorMixin, OAuthLoaderMixin
from treeherder.etl.buildbot import get_symbols_and_platforms
from treeherder.etl.oauth_utils import OAuthCredentials


class AllthethingsTransformerMixin:

    def transform(self, extracted_content):
        th_collections = {}

        for builder, content in extracted_content['builders'].iteritems():
            job = get_symbols_and_platforms(builder)

            branch = content['properties']['branch']
            job.update({'branch': branch})

            # allthethings.json contains some projects like 'release-mozilla-beta',
            # which should be ignored.
            if not OAuthCredentials.get_credentials(branch):
                continue

            if branch not in th_collections:
                th_collections[branch] = TreeherderCollection('possible_jobs')
            th_collections[branch].add(TreeherderPossibleJob(job))

        return th_collections


class PossibleJobsProcess(JsonExtractorMixin,
                          AllthethingsTransformerMixin,
                          OAuthLoaderMixin):
    def run(self):
        extracted_content = self.extract(settings.ALLTHETHINGS_URL)
        possible_job_collections = self.transform(extracted_content)
        self.load(possible_job_collections, chunk_size=settings.ALLTHETHINGS_CHUNK_SIZE)

        return True
