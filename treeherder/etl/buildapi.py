from django.conf import settings
import logging

from . import buildbot
from .common import get_revision_hash, get_job_guid, JobData
from .mixins import JsonExtractorMixin, JobsLoaderMixin


logger = logging.getLogger()


class PendingTransformerMixin(object):

    def transform(self, data):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        job_list = []
        for branch, revisions in data['pending'].items():
            for rev, jobs in revisions.items():
                for job in jobs:
                    treeherder_data = {
                        'sources': [],
                        #Include branch so revision hash with the same revision is still
                        #unique across branches
                        'revision_hash': get_revision_hash(
                            [rev, branch]
                        ),
                    }
                    treeherder_data['sources'].append({
                        # repository name is always lowercase
                        'repository': branch.lower(),
                        'revision': rev,
                    })

                    platform_info = buildbot.extract_platform_info(job['buildername'])

                    job = {
                        'job_guid': get_job_guid(job['id'], job['submitted_at']),
                        'name': buildbot.extract_test_name(job['buildername']),
                        'state': 'pending',
                        'submit_timestamp': job['submitted_at'],
                        'build_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },
                        #where are we going to get this data from?
                        'machine_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },
                        'who': 'unknown',

                        'option_collection': {
                            # build_type contains an option name, eg. PGO
                            buildbot.extract_build_type(job['buildername']): True
                        },
                        'log_references': []
                    }
                    treeherder_data['job'] = job

                    job_list.append(JobData(treeherder_data))
        return job_list


class RunningTransformerMixin(object):

    def transform(self, data):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        job_list = []
        for branch, revisions in data['running'].items():
            for rev, jobs in revisions.items():
                for job in jobs:
                    treeherder_data = {
                        'sources': [],
                        #Include branch so revision hash with the same revision is still
                        #unique across branches
                        'revision_hash': get_revision_hash(
                            [rev, branch]
                        ),
                    }
                    treeherder_data['sources'].append({
                        # repository name is always lowercase
                        'repository': branch.lower(),
                        'revision': rev,
                    })

                    platform_info = buildbot.extract_platform_info(job['buildername'])

                    job = {
                        'job_guid': get_job_guid(
                            job['request_ids'][0],
                            job['submitted_at']
                        ),
                        'name': buildbot.extract_test_name(job['buildername']),
                        'state': 'running',
                        'submit_timestamp': job['submitted_at'],
                        'build_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },
                        #where are we going to get this data from?
                        'machine_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },
                        'who': 'unknown',

                        'option_collection': {
                            # build_type contains an option name, eg. PGO
                            buildbot.extract_build_type(job['buildername']): True
                        },
                        'log_references': []
                    }

                    treeherder_data['job'] = job

                    job_list.append(JobData(treeherder_data))
        return job_list


class PendingJobsProcess(JsonExtractorMixin,
                         PendingTransformerMixin,
                         JobsLoaderMixin):
    def run(self):
        self.load(
            self.transform(
                self.extract(settings.BUILDAPI_PENDING_URL)
            )
        )


class RunningJobsProcess(JsonExtractorMixin,
                         RunningTransformerMixin,
                         JobsLoaderMixin):
    def run(self):
        self.load(
            self.transform(
                self.extract(settings.BUILDAPI_RUNNING_URL)
            )
        )
