import logging
from collections import defaultdict
from django.conf import settings

from . import buildbot
from treeherder.etl import common
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


    def transform(self, data):
        """
        transform the builds4h structure into something we can ingest via
        our restful api
        """
        job_list = []
        revisions = defaultdict(list)

        projects = set(x.project for x in Datasource.objects.cached())

        for build in data['builds']:
            prop = build['properties']
            if not prop['branch'] in projects:
                continue
            prop['revision'] = prop.get('revision',
                            prop.get('got_revision',
                                prop.get('sourcestamp', None)))

            if not prop['revision']:
                continue
            revisions[prop['branch']].append(prop['revision'][0:12])

        revisions_lookup = common.lookup_revisions(revisions)

        for build in data['builds']:
            prop = build['properties']

            try:
                resultset = revisions_lookup[prop['branch']][prop['revision']]
            except KeyError:
                # this branch is not one of those we care about
                continue

            treeherder_data = {
                'revision_hash': resultset['revision_hash'],
                'resultset_id': resultset['id'],
                'project': prop['branch'],
            }

            platform_info = buildbot.extract_platform_info(prop['buildername'])
            job_name_info = buildbot.extract_name_info(prop['buildername'])

            if 'log_url' in prop:
                log_reference = [{
                    'url': prop['log_url'],
                    'name': 'builds-4h'
                }]
            else:
                log_reference = []

            job = {
                'job_guid': self.find_job_guid(build),
                'name': job_name_info['name'],
                'symbol': job_name_info['symbol'],
                'group_name': job_name_info['group_name'],
                'group_symbol': job_name_info['group_symbol'],
                'buildername': prop['buildername'],
                'product_name': prop['product'],
                'state': 'completed',
                'result': buildbot.RESULT_DICT[build['result']],
                'reason': build['reason'],
                #scheduler, if 'who' property is not present
                'who': prop.get('who', prop.get('scheduler', '')),
                'submit_timestamp': build['requesttime'],
                'start_timestamp': build['starttime'],
                'end_timestamp': build['endtime'],
                'machine': prop.get('slavename', 'unknown'),
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
                    buildbot.extract_build_type(prop['buildername']): True
                },
                'log_references': log_reference,
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
        revision_dict = defaultdict(list)

        # loop to catch all the revisions
        for project, revisions in data['pending'].items():
            # this skips those projects we don't care about
            if project not in projects:
                continue

            for rev, jobs in revisions.items():
                revision_dict[project].append(rev)
        # retrieving the revision->resultset lookups
        revisions_lookup = common.lookup_revisions(revision_dict)

        for project, revisions in revisions_lookup.items():

            for revision in revisions:

                resultset = revisions[revision]
                # using project and revision form the revision lookups
                # to filter those jobs with unmatched revision
                for job in data['pending'][project][revision]:

                    treeherder_data = {
                        'revision_hash': resultset['revision_hash'],
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    platform_info = buildbot.extract_platform_info(job['buildername'])
                    job_name_info = buildbot.extract_name_info(job['buildername'])

                    job = {
                        'job_guid': common.generate_job_guid(job['id'], job['submitted_at']),
                        'name': job_name_info['name'],
                        'symbol': job_name_info['symbol'],
                        'group_name': job_name_info['group_name'],
                        'group_symbol': job_name_info['group_symbol'],
                        'buildername': job['buildername'],
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
        revision_dict = defaultdict(list)

        # loop to catch all the revisions
        for project, revisions in data['running'].items():
            # this skips those projects we don't care about
            if project not in projects:
                continue

            for rev, jobs in revisions.items():
                revision_dict[project].append(rev)

        # retrieving the revision->resultset lookups
        revisions_lookup = common.lookup_revisions(revision_dict)

        for project, revisions in revisions_lookup.items():

            for revision in revisions:

                resultset = revisions[revision]
                # using project and revision form the revision lookups
                # to filter those jobs with unmatched revision
                for job in data['running'][project][revision]:
                    treeherder_data = {
                        'revision_hash': resultset['revision_hash'],
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    platform_info = buildbot.extract_platform_info(job['buildername'])
                    job_name_info = buildbot.extract_name_info(job['buildername'])

                    job = {
                        'job_guid': common.generate_job_guid(
                            job['request_ids'][0],
                            job['submitted_at']
                        ),
                        'name': job_name_info['name'],
                        'symbol': job_name_info['symbol'],
                        'group_name': job_name_info['group_name'],
                        'group_symbol': job_name_info['group_symbol'],
                        'buildername': job['buildername'],
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
        extracted_content = self.extract(settings.BUILDAPI_BUILDS4H_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content)
            )


class PendingJobsProcess(JsonExtractorMixin,
                         PendingTransformerMixin,
                         JobsLoaderMixin):
    def run(self):
        extracted_content = self.extract(settings.BUILDAPI_PENDING_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content)
            )


class RunningJobsProcess(JsonExtractorMixin,
                         RunningTransformerMixin,
                         JobsLoaderMixin):
    def run(self):
        extracted_content = self.extract(settings.BUILDAPI_RUNNING_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content)
            )
