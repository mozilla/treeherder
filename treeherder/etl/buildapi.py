import logging
import time
import datetime
import json
import os

from collections import defaultdict
from django.conf import settings

from treeherder.etl import common, buildbot
from treeherder.etl.mixins import JsonExtractorMixin, ObjectstoreLoaderMixin, JobsLoaderMixin
from treeherder.model.models import Datasource


logger = logging.getLogger(__name__)


class Builds4hTransformerMixin(object):

    def find_job_guid(self, build):
        """
        returns the job_guid, based on request id and request time.
        necessary because request id and request time is inconsistently
        represented in builds4h
        """
        prop = build['properties']

        #get the request_id from two possible places
        request_ids = prop.get('request_ids', [])
        request_ids_str = ""
        if request_ids == []:
            request_ids_str = ','.join(
                map(str, build.get('request_ids', []))
                )
        else:
            request_ids_str = ','.join(map(str, request_ids))

        #get the request_time from two possible places
        request_time_dict = prop.get('request_times', {})
        if request_time_dict != {}:

            request_times_str = ','.join(
                map(str, request_time_dict.values())
                )

        else:

            request_times_str = str(build['requesttime'])

        job_guid_data = { 'job_guid':'', 'coalesced':[] }

        if len(request_ids) > 1:
            # coallesced job detected, generate the coalesced
            # job guids
            for r_id in request_ids:
                r_id_str = str(r_id)
                if r_id_str in request_time_dict:
                    job_guid_data['coalesced'].append(
                        common.generate_job_guid(
                            r_id_str, request_time_dict[r_id_str]
                            ))

        job_guid_data['job_guid'] = common.generate_job_guid(
            request_ids_str, request_times_str)

        return job_guid_data

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

            if not 'branch' in prop:
                logger.warning("property 'branch' not found in build4h")
                continue

            if not prop['branch'] in projects:
                logger.warning("skipping job on branch {0}".format(prop['branch']))
                continue

            prop['revision'] = prop.get('revision',
                            prop.get('got_revision',
                                prop.get('sourcestamp', None)))

            if not prop['revision']:
                logger.warning("property 'revision' not found in build4h")
                continue

            prop['revision'] = prop['revision'][0:12]
            revisions[prop['branch']].append(prop['revision'])

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
                'coalesced': []
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

            job_guid_data = self.find_job_guid(build)

            treeherder_data['coalesced'] = job_guid_data['coalesced']

            job = {
                'job_guid': job_guid_data['job_guid'],
                'name': job_name_info.get('name', ''),
                'job_symbol': job_name_info.get('job_symbol', ''),
                'group_name': job_name_info.get('group_name', ''),
                'group_symbol': job_name_info.get('group_symbol', ''),
                'buildername': prop['buildername'],
                'product_name': prop.get('product', ''),
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
                        'name': job_name_info.get('name', ''),
                        'job_symbol': job_name_info.get('job_symbol', ''),
                        'group_name': job_name_info.get('group_name', ''),
                        'group_symbol': job_name_info.get('group_symbol', ''),
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
                        'name': job_name_info.get('name', ''),
                        'job_symbol': job_name_info.get('job_symbol', ''),
                        'group_name': job_name_info.get('group_name', ''),
                        'group_symbol': job_name_info.get('group_symbol', ''),
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

class Builds4hAnalyzer(JsonExtractorMixin, Builds4hTransformerMixin):

    def __init__(self):

        # builds4h deserialized json
        self.raw_data = []
        self.blacklist = set()

        self.t_stamp = int(time.time())
        self.readable_time = datetime.datetime.fromtimestamp(
            self.t_stamp).strftime('%Y-%m-%d %H:%M:%S')

        # data structures for missing attributes
        self.report_obj = {
            'analyzers':{
                'branch_misses': {
                    'title':'{0} Objects Missing Branch Attribute',
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_branch_misses
                    },
                'log_url_misses': {
                    'title':'{0} Objects Missing log_url Attribute',
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_log_url_misses
                    },
                'slavename_misses': {
                    'title':'{0} Objects Missing slavename Attribute',
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_slavename_misses
                    },
                'job_guid_misses': {
                    'title':'{0} Objects Missing Job Guids or Request Ids',
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_job_guid_misses,
                    },
                'platform_regex_misses':{
                    'title':('{0} Buildernames Not Found '
                             'By Platform Regular Expressions'),
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_platform_regex_misses,
                    },
                'job_type_regex_misses':{
                    'title':('{0} Buildernames Not Found By Job Type '
                             'Regular Expressions (Defaults to Build)'),
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_job_type_regex_misses,
                    },
                'test_name_regex_misses':{
                    'title':('{0} Buildernames Not Found By Test Name '
                             'Regular Expressions'),
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_test_name_regex_misses,
                    },
                'revision_misses': {
                    'title':'{0} Objects Missing Revisions',
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_revision_misses,
                    },
                'objects_missing_buildernames': {
                    'title':'{0} Objects With No Buildername',
                    'data':{},
                    'all_misses':0,
                    'get_func':self.get_objects_missing_buildernames,
                    },
                },

            'guids': {}

            }

        # load last analysis data
        self.data_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'treeherder',
            settings.MEDIA_ROOT,
            'builds4hanalysis'
            )

        # file that stores the json data
        self.builds4h_analysis_file_path = os.path.join(
            self.data_path, 'builds4h_analysis.json')

        # file that stores the report to display
        self.builds4h_report_file_path = os.path.join(
            self.data_path, 'builds4h_report.txt')

        # blacklist file for buildernames and ids
        self.builds4h_blacklist_file_path = os.path.join(
            self.data_path, 'blacklist.json')

    def run(self):

        self.get_blacklist()
        self.get_analysis_file()

        self.raw_data = self.extract(settings.BUILDAPI_BUILDS4H_URL)

        for build in self.raw_data['builds']:

            buildername = build['properties'].get('buildername', None)

            if buildername in self.blacklist:
                continue

            job_guid_data = self.find_job_guid(build)

            for analysis_type in self.report_obj['analyzers']:

                self.report_obj['analyzers'][analysis_type]['get_func'](
                    analysis_type, build, buildername,
                    job_guid_data['job_guid'])

                self._increment_buildername_total_count(
                    analysis_type, buildername, job_guid_data['job_guid'])


            if job_guid_data['job_guid']:
                self.report_obj['guids'][job_guid_data['job_guid']] = True

        ##Add up all misses here
        for analysis_type in self.report_obj['analyzers']:
            for buildername in self.report_obj['analyzers'][analysis_type]['data']:
                self.report_obj['analyzers'][analysis_type]['all_misses'] += \
                    self.report_obj['analyzers'][analysis_type]['data'][buildername]['missed_count']

        self.write_report()

    def get_analysis_file(self):

        if os.path.isfile(self.builds4h_analysis_file_path):
            # Set the data attribute in the report object to whats
            # found in the analysis file
            with open(self.builds4h_analysis_file_path) as f:
                data = f.read()
                deserialized_data = json.loads(data)

                self.report_obj['guids'] = deserialized_data['guids'] or {}

                for analysis_type in deserialized_data['analyzers']:
                    self.report_obj['analyzers'][analysis_type]['data'] = \
                        deserialized_data['analyzers'][analysis_type]

    def get_blacklist(self):

        if os.path.isfile(self.builds4h_blacklist_file_path):
            with open(self.builds4h_blacklist_file_path) as f:
                data = f.read()
                deserialized_data = json.loads(data)
                self.blacklist = set(deserialized_data)

    def write_report(self):

        report_fh = open(self.builds4h_report_file_path, 'w')
        divider = "------------------------------------------------------\n"

        header_line = "Builds4h Report Last Run Time {0}\n".format(
            self.readable_time)
        report_fh.write(header_line)
        report_fh.write(divider)

        data_to_write = { 'analyzers':{}, 'guids':{} }
        data_to_write['guids'] = self.report_obj['guids']

        for analyzer in sorted(self.report_obj['analyzers']):

            # Set data for json structure
            data_to_write['analyzers'][analyzer] = \
                self.report_obj['analyzers'][analyzer]['data']

            # Remove any blacklist names found
            for exclude_name in self.blacklist:
                if exclude_name in self.report_obj['analyzers'][analyzer]['data']:
                    del self.report_obj['analyzers'][analyzer]['data'][exclude_name]

            # Write the title line
            all_misses = self.report_obj['analyzers'][analyzer]['all_misses']

            if all_misses > 0:
                title = self.report_obj['analyzers'][analyzer].get(
                    'title', '{0} Needs Title')
                report_fh.write(
                    "{0}\n".format(title.format(str(all_misses)))
                    )
                report_fh.write(divider)
            else:
                continue

            # Write out display report
            for k, v in sorted(
                self.report_obj['analyzers'][analyzer]['data'].iteritems(),
                key=lambda (k,v): (v['first_seen'], k)):

                if k in self.blacklist:
                    continue

                if v['missed_count'] == 0:
                    continue

                readable_time = datetime.datetime.fromtimestamp(
                    v['first_seen']).strftime('%Y-%m-%d')

                line = "{0}\t{1}\t{2}/{3}\n".format(
                    str(k), readable_time, str(v['missed_count']),
                    str(v['total_count']))

                report_fh.write(line)

                if len(v['objects']) > 0:
                    for o in v['objects']:
                        report_fh.write("\n{0}\n\n".format(o))

            report_fh.write(divider)

        report_fh.close()

        # Write out the data json
        f = open(self.builds4h_analysis_file_path, 'w')
        f.write(json.dumps(data_to_write))
        f.close()

    def get_objects_missing_buildernames(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            b_id = str(build.get('builder_id', 'No id attribute found'))
            self._load_missed_buildername(
                analysis_type, b_id, job_guid, build)

    def get_branch_misses(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            return

        # test for missing branch
        if 'branch' not in build['properties']:
            self._load_missed_buildername(
                analysis_type, buildername, job_guid
                )

    def get_log_url_misses(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            return

        log_url = build['properties'].get('log_url', None)

        if not log_url:
            self._load_missed_buildername(
                analysis_type, buildername, job_guid, build
                )

    def get_slavename_misses(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            return

        slavename = build['properties'].get('slavename', None)

        if not slavename:
            self._load_missed_buildername(
                analysis_type, buildername, job_guid, build
                )

    def get_revision_misses(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            return

        revision = build['properties'].get('revision',
            build['properties'].get('got_revision',
            build['properties'].get('sourcestamp', None)))

        if not revision:
            self._load_missed_buildername(
                analysis_type, buildername, job_guid, build
                )

    def get_job_guid_misses(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            return

        # test for successful job_guid formulation
        job_guid_data = self.find_job_guid(build)
        if not job_guid_data['job_guid']:
            self._load_missed_buildername(
                analysis_type, buildername, job_guid, build
                )

    def get_platform_regex_misses(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            return

        # Match platforms
        platform_target = buildbot.extract_platform_info(buildername)

        if platform_target['os'] == 'unknown':
            self._load_missed_buildername(
                analysis_type, buildername, job_guid
                )

    def get_job_type_regex_misses(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            return

        job_type_target = buildbot.extract_job_type(
            buildername, default=None)

        if not job_type_target:
            self._load_missed_buildername(
                analysis_type, buildername, job_guid
                )

    def get_test_name_regex_misses(
        self, analysis_type, build, buildername, job_guid):

        if not buildername:
            return

        name_info = buildbot.extract_name_info(buildername)

        if name_info['name'] == 'unknown':
            self._load_missed_buildername(
                analysis_type, buildername, job_guid
                )

    def _increment_buildername_total_count(
        self, key, buildername, job_guid):

        self._initialize_buildername(key, buildername)

        if job_guid not in self.report_obj['guids']:
            self.report_obj['analyzers'][key]['data'][buildername]['total_count'] += 1

    def _load_missed_buildername(
        self, key, buildername, job_guid, build=None):

        self._initialize_buildername(key, buildername)

        if job_guid not in self.report_obj['guids']:
            self.report_obj['analyzers'][key]['data'][buildername]['missed_count'] += 1

        if build:
            # Store one sample object for examination
            if not self.report_obj['analyzers'][key]['data'][buildername]['objects']:
                self.report_obj['analyzers'][key]['data'][buildername]['objects'].append(
                    json.dumps(build))

    def _initialize_buildername(self, key, buildername):

        builder_found = self.report_obj['analyzers'][key]['data'].get(
            buildername)

        if not builder_found:
            self.report_obj['analyzers'][key]['data'][buildername] = {
                'first_seen': self.t_stamp,
                'missed_count': 0,
                'total_count': 0,
                'objects': []
                }
