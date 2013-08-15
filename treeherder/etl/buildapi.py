from django.conf import settings
import logging

from . import buildbot
from .common import get_revision_hash, get_job_guid, JobData
from .mixins import JsonExtractorMixin, JobsLoaderMixin


logger = logging.getLogger()

class Builds4hTransformerMixin(object):

    def find_job_guid(self, build):
        """
        returns the job_guid, based on request id and request time.
        necessary because request id and request time is inconsistently
        represented in builds4h
        """
        prop = build['properties']

        #get the request_id from two possible places
        request_id = prop.get('request_ids', '')
        if request_id == '':
            request_id = build['request_ids'][-1]
        else:
            request_id = request_id[-1]

        #get the request_time from two possible places
        request_time_dict = prop.get('request_times', '')
        if request_time_dict != '':
            request_time = request_time_dict[str(request_id)]
            return get_job_guid(request_id, request_time)
        else:
            request_time = build['requesttime']
            return get_job_guid(request_id, request_time)

    def extract_option_info(self, source_string):
        output = {}
        if (source_string.find('pgo-build') > 0):
            output = {
            'option_name': 'pgo',
            'value': True
        }
        else:
            output = {
                'option_name': 'non-pgo',
                'value': False
            }
        return output

    def transform(self, data):
        """
        transform the builds4h structure into something we can ingest via
        our restful api
        """
        job_list = []
        for build in data['builds']:
            prop = build['properties']
            treeherder_data = {
                'sources': [],
                'revision_hash': get_revision_hash(
                    [prop['revision'], prop['branch']]
                ),
            }
            treeherder_data['sources'].append({
                'repository': prop['branch'],
                'revision': prop['revision'],
            })

            platform_info = buildbot.extract_platform_info(prop['buildername'])
            option_info = self.extract_option_info(prop['buildername'])

            job = {
                'job_guid': self.find_job_guid(build),
                'name': prop['buildername'],
                'product_name': prop['product'],
                'state': 'completed',
                'result': build['result'],
                'reason': build['reason'],
                #scheduler, if 'who' property is not present
                'who': prop.get('who', prop.get('scheduler', '')),
                'submit_timestamp': build['requesttime'],
                'start_timestamp': build['starttime'],
                'end_timestamp': build['endtime'],
                'machine': prop['slavename'],
                #build_url not present in all builds
                'build_url': prop.get('build_url', ''),
                #build_platform same as machine_platform
                'build_platform': {
                    #platform attributes sometimes parse without results
                    'os_name': platform_info.get('os', ''),
                    'platform': platform_info.get('os_platform', ''),
                    'architecture': platform_info.get('arch', '')
                },
                'machine_platform': {
                    'os_name': platform_info.get('os', ''),
                    'platform': platform_info.get('os_platform', ''),
                    'architecture': platform_info.get('arch', '')
                },
                #pgo or non-pgo dependent on buildername parsing
                'option_collection': {
                    option_info['option_name']: option_info['value']
                },
                'log_references': [{
                    'url': prop['log_url'],
                    'name': 'builds-4h'
                }],
                'artifact': {
                    'type': '',
                    'name': '',
                    'log_urls': [],
                    'blob': ''
                }
            }
            treeherder_data['job'] = job

            job_list.append(JobData(treeherder_data))

        return job_list

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

class Builds4hJobsProcess(JsonExtractorMixin,
                          Builds4hTransformerMixin,
                          JobsLoaderMixin):
    def run(self):
        self.load(
            self.transform(
                self.extract(settings.BUILDAPI_BUILDS4H_URL)
            )
        )

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
