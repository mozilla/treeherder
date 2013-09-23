from django.conf import settings
import logging

from . import buildbot
from treeherder.etl import common
from treeherder.etl import buildbot
from treeherder.model.models import Datasource
from .mixins import JsonExtractorMixin, ObjectstoreLoaderMixin, JobsLoaderMixin


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
            return common.generate_job_guid(request_id, request_time)
        else:
            request_time = build['requesttime']
            return common.generate_job_guid(request_id, request_time)

    def extract_option_info(self, source_string):
        output = {}
        if source_string.find('pgo-build') > 0:
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
            revision = prop.get('revision',
                            prop.get('got_revision',
                                prop.get('sourcestamp', None)))
            if not revision:
                continue
            resultset = common.get_resultset(prop['branch'], revision)
            if not resultset:
                continue

            treeherder_data = {
                'revision_hash': resultset['revision_hash'],
                'resultset_id': resultset['id'],
                'project': prop['branch'],
            }

            platform_info = buildbot.extract_platform_info(prop['buildername'])
            option_info = self.extract_option_info(prop['buildername'])

            job = {
                'job_guid': self.find_job_guid(build),
                'name': prop['buildername'],
                'product_name': prop['product'],
                'state': 'completed',
                'result': buildbot.RESULT_DICT[build['result']],
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

            job_list.append(common.JobData(treeherder_data))

        return job_list


class PendingTransformerMixin(object):

    def transform(self, data):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        job_list = []

        projects = set(x.project for x in Datasource.objects.cached())
        for project, revisions in data['pending'].items():
            if not project in projects:
                continue
            for rev, jobs in revisions.items():
                resultset = common.get_resultset(project, rev)
                if not resultset:
                    continue
                for job in jobs:
                    treeherder_data = {
                        'revision_hash': resultset['revision_hash'],
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    platform_info = buildbot.extract_platform_info(job['buildername'])

                    job = {
                        'job_guid': common.generate_job_guid(job['id'], job['submitted_at']),
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

                    job_list.append(common.JobData(treeherder_data))
        return job_list


class RunningTransformerMixin(object):

    def transform(self, data):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        job_list = []
        projects = set(x.project for x in Datasource.objects.cached())
        for project, revisions in data['running'].items():
            if not project in projects:
                continue
            for rev, jobs in revisions.items():
                resultset = common.get_resultset(project, rev)
                if not resultset:
                    continue

                for job in jobs:
                    treeherder_data = {
                        'revision_hash': resultset['revision_hash'],
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    platform_info = buildbot.extract_platform_info(job['buildername'])

                    job = {
                        'job_guid': common.generate_job_guid(
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

                    job_list.append(common.JobData(treeherder_data))
        return job_list


class Builds4hJobsProcess(JsonExtractorMixin,
                          Builds4hTransformerMixin,
                          ObjectstoreLoaderMixin):
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
