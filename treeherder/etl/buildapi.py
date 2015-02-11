# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import logging
import time
import datetime
import simplejson as json
import os
import copy

from collections import defaultdict
from django.conf import settings
from thclient import TreeherderJobCollection

from treeherder.etl import common, buildbot
from treeherder.etl.mixins import JsonExtractorMixin, OAuthLoaderMixin
from treeherder.model.models import Datasource


logger = logging.getLogger(__name__)


class Builds4hTransformerMixin(object):


    def find_job_guid(self, build):
        """
        returns the job_guid, based on request id and request time.
        necessary because request id and request time is inconsistently
        represented in builds4h
        """

        # this is reused in the transformer and the analyzer, so reverting
        # the field getters to this function.

        # request_id and request_time are mandatory
        # and they can be found in a couple of different places
        prop = build['properties']
        try:
            request_ids = build['properties'].get('request_ids',
                                                  build['request_ids'])
        except KeyError as e:
            logger.error("({0})request_id not found in {1}".format(
                prop["branch"], build))
            raise e

        try:
            request_times = build['properties'].get('request_times',
                                                    build['requesttime'])
        except KeyError as e:
            logger.error("({0})request_time not found in {1}".format(
                prop["branch"], build))
            raise e

        endtime = None
        if buildbot.RESULT_DICT[build['result']] == 'retry':
            try:
                endtime = build['endtime']
            except KeyError as e:
                logger.error("({0})endtime not found in {1}".format(
                    prop["branch"], build))
                raise e

        request_id = request_ids[-1]
        request_time = request_times[str(request_id)]

        job_guid_data = {'job_guid': '', 'coalesced': []}

        if len(request_ids) > 1:
            # coallesced job detected, generate the coalesced job guids

            # build the list of job_guids that were coalesced.  But skip
            # the last request_id, which is the current job, because
            # it was not, itself, coalesced.  The other requests were
            # coalesced to it.
            for r_id in request_ids[:-1]:
                try:
                    job_guid_data['coalesced'].append(
                        common.generate_job_guid(r_id, request_times[r_id]))
                except KeyError:
                    # if this r_id doesn't have a corresponding time, then skip
                    pass

        job_guid_data['job_guid'] = common.generate_job_guid(
            request_id, request_time, endtime)

        return job_guid_data

    def transform(self, data, filter_to_project=None, filter_to_revision=None):
        """
        transform the builds4h structure into something we can ingest via
        our restful api
        """
        revisions = defaultdict(list)
        missing_resultsets = defaultdict(set)

        projects = set(x.project for x in Datasource.objects.cached())

        for build in data['builds']:
            prop = build['properties']

            if not 'branch' in prop:
                logger.warning("property 'branch' not found in build4h")
                continue

            if not prop['branch'] in projects:
                logger.warning("skipping job on unsupported branch {0}".format(prop['branch']))
                continue

            if filter_to_project and prop['branch'] != filter_to_project:
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

        # Holds one collection per unique branch/project
        th_collections = {}

        for build in data['builds']:
            try:
                prop = build['properties']
                project = prop['branch']
                artifact_build = copy.deepcopy(build)
                resultset = common.get_resultset(project,
                                                 revisions_lookup,
                                                 prop['revision'],
                                                 missing_resultsets,
                                                 logger)
            except KeyError:
                # skip this job, at least at this point
                continue
            if filter_to_revision and filter_to_revision != resultset['revision']:
                continue

            treeherder_data = {
                'revision_hash': resultset['revision_hash'],
                'resultset_id': resultset['id'],
                'project': project,
                'coalesced': []
            }

            platform_info = buildbot.extract_platform_info(prop['buildername'])
            job_name_info = buildbot.extract_name_info(prop['buildername'])

            device_name = buildbot.get_device_or_unknown(
                job_name_info.get('name', ''),
                platform_info['vm']
            )

            if 'log_url' in prop:
                log_reference = [{
                    'url': prop['log_url'],
                    'name': 'builds-4h'
                }]
            else:
                log_reference = []

            # request_id and request_time are mandatory
            # and they can be found in a couple of different places
            try:
                job_guid_data = self.find_job_guid(build)
                request_ids = build['properties'].get('request_ids',
                                      build['request_ids'])
            except KeyError:
                continue

            treeherder_data['coalesced'] = job_guid_data['coalesced']

            def prop_remove(field):
                try:
                    del(artifact_build['properties'][field])
                except:
                    pass

            prop_remove("product")
            prop_remove("project")
            prop_remove("buildername")
            prop_remove("slavename")
            prop_remove("build_url")
            prop_remove("log_url")
            prop_remove("slavebuilddir")
            prop_remove("branch")
            prop_remove("repository")
            prop_remove("revision")

            del(artifact_build['requesttime'])
            del(artifact_build['starttime'])
            del(artifact_build['endtime'])


            job = {
                'job_guid': job_guid_data['job_guid'],
                'name': job_name_info.get('name', ''),
                'job_symbol': job_name_info.get('job_symbol', ''),
                'group_name': job_name_info.get('group_name', ''),
                'group_symbol': job_name_info.get('group_symbol', ''),
                'reference_data_name': prop['buildername'],
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
                'device_name': device_name,
                #pgo or non-pgo dependent on buildername parsing
                'option_collection': {
                    buildbot.extract_build_type(prop['buildername']): True
                },
                'log_references': log_reference,
                'artifacts': [
                    {
                        'type': 'json',
                        'name': 'buildapi_complete',
                        'log_urls': [],
                        'blob': artifact_build
                    },
                    {
                        'type': 'json',
                        'name': 'buildapi',
                        'log_urls': [],
                        'blob': {
                            'buildername': build['properties']['buildername'],
                            'request_id': request_ids[-1]
                        }
                    },
                ]
            }

            treeherder_data['job'] = job

            if project not in th_collections:
                th_collections[ project ] = TreeherderJobCollection()

            # get treeherder job instance and add the job instance
            # to the collection instance
            th_job = th_collections[project].get_job(treeherder_data)
            th_collections[project].add( th_job )

        if missing_resultsets and not filter_to_revision:
            common.fetch_missing_resultsets("builds4h", missing_resultsets, logger)

        return th_collections


class PendingTransformerMixin(object):

    def transform(self, data, filter_to_revision=None, filter_to_project=None):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """

        projects = set(x.project for x in Datasource.objects.cached())
        revision_dict = defaultdict(list)
        missing_resultsets = defaultdict(set)

        # loop to catch all the revisions
        for project, revisions in data['pending'].iteritems():
            # this skips those projects we don't care about
            if project not in projects:
                continue

            if filter_to_project and project != filter_to_project:
                continue

            for rev, jobs in revisions.items():
                revision_dict[project].append(rev)
        # retrieving the revision->resultset lookups
        revisions_lookup = common.lookup_revisions(revision_dict)

        th_collections = {}

        for project, revisions in data['pending'].iteritems():

            for revision, jobs in revisions.items():

                try:
                    resultset = common.get_resultset(project,
                                                     revisions_lookup,
                                                     revision,
                                                     missing_resultsets,
                                                     logger)
                except KeyError:
                    # skip this job, at least at this point
                    continue

                if filter_to_revision and filter_to_revision != resultset['revision']:
                    continue

                # using project and revision form the revision lookups
                # to filter those jobs with unmatched revision
                for pending_job in jobs:

                    treeherder_data = {
                        'revision_hash': resultset['revision_hash'],
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    platform_info = buildbot.extract_platform_info(pending_job['buildername'])

                    job_name_info = buildbot.extract_name_info(pending_job['buildername'])

                    device_name = buildbot.get_device_or_unknown(
                        job_name_info.get('name', ''),
                        platform_info['vm']
                    )

                    new_job = {
                        'job_guid': common.generate_job_guid(pending_job['id'], pending_job['submitted_at']),
                        'name': job_name_info.get('name', ''),
                        'job_symbol': job_name_info.get('job_symbol', ''),
                        'group_name': job_name_info.get('group_name', ''),
                        'group_symbol': job_name_info.get('group_symbol', ''),
                        'reference_data_name': pending_job['buildername'],
                        'state': 'pending',
                        'submit_timestamp': pending_job['submitted_at'],
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
                        'device_name': device_name,
                        'who': 'unknown',

                        'option_collection': {
                            # build_type contains an option name, eg. PGO
                            buildbot.extract_build_type(pending_job['buildername']): True
                        },
                        'log_references': [],
                        'artifacts': [
                            {
                                'type': 'json',
                                'name': 'buildapi_pending',
                                'log_urls': [],
                                'blob': pending_job
                            },
                            {
                                'type': 'json',
                                'name': 'buildapi',
                                'log_urls': [],
                                'blob': {
                                    'buildername': pending_job['buildername'],
                                    'request_id': pending_job['id']
                                }
                            },
                        ]

                    }
                    treeherder_data['job'] = new_job

                    if project not in th_collections:
                        th_collections[project] = TreeherderJobCollection(
                            job_type='update'
                        )

                    # get treeherder job instance and add the job instance
                    # to the collection instance
                    th_job = th_collections[project].get_job(treeherder_data)
                    th_collections[project].add(th_job)

        if missing_resultsets and not filter_to_revision:
            common.fetch_missing_resultsets("pending", missing_resultsets, logger)

        return th_collections


class RunningTransformerMixin(object):

    def transform(self, data, filter_to_revision=None, filter_to_project=None):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        projects = set(x.project for x in Datasource.objects.cached())
        revision_dict = defaultdict(list)
        missing_resultsets = defaultdict(set)

        # loop to catch all the revisions
        for project, revisions in data['running'].items():
            # this skips those projects we don't care about
            if project not in projects:
                continue

            if filter_to_project and project != filter_to_project:
                continue

            for rev, jobs in revisions.items():
                revision_dict[project].append(rev)

        # retrieving the revision->resultset lookups
        revisions_lookup = common.lookup_revisions(revision_dict)

        th_collections = {}

        for project, revisions in data['running'].items():

            for revision, jobs in revisions.items():

                try:
                    resultset = common.get_resultset(project,
                                                     revisions_lookup,
                                                     revision,
                                                     missing_resultsets,
                                                     logger)
                except KeyError:
                    # skip this job, at least at this point
                    continue

                if filter_to_revision and filter_to_revision != resultset['revision']:
                    continue

                # using project and revision form the revision lookups
                # to filter those jobs with unmatched revision
                for running_job in jobs:
                    treeherder_data = {
                        'revision_hash': resultset['revision_hash'],
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    platform_info = buildbot.extract_platform_info(running_job['buildername'])
                    job_name_info = buildbot.extract_name_info(running_job['buildername'])
                    device_name = buildbot.get_device_or_unknown(
                        job_name_info.get('name', ''),
                        platform_info['vm']
                    )

                    new_job = {
                        'job_guid': common.generate_job_guid(
                            running_job['request_ids'][-1],
                            running_job['submitted_at']
                        ),
                        'name': job_name_info.get('name', ''),
                        'job_symbol': job_name_info.get('job_symbol', ''),
                        'group_name': job_name_info.get('group_name', ''),
                        'group_symbol': job_name_info.get('group_symbol', ''),
                        'reference_data_name': running_job['buildername'],
                        'state': 'running',
                        'submit_timestamp': running_job['submitted_at'],
                        'start_timestamp': running_job['start_time'],
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
                        'device_name': device_name,
                        'who': 'unknown',

                        'option_collection': {
                            # build_type contains an option name, eg. PGO
                            buildbot.extract_build_type(running_job['buildername']): True
                        },
                        'log_references': [],
                        'artifacts': [
                            {
                                'type': 'json',
                                'name': 'buildapi_running',
                                'log_urls': [],
                                'blob': running_job
                            },
                            {
                                'type': 'json',
                                'name': 'buildapi',
                                'log_urls': [],
                                'blob': {
                                    'buildername': running_job['buildername'],
                                    'request_id': running_job['request_ids'][-1]
                                }
                            },
                        ]
                    }

                    treeherder_data['job'] = new_job

                    if project not in th_collections:
                        th_collections[ project ] = TreeherderJobCollection(
                            job_type='update'
                            )

                    # get treeherder job instance and add the job instance
                    # to the collection instance
                    th_job = th_collections[project].get_job(treeherder_data)
                    th_collections[project].add(th_job)

        if missing_resultsets and not filter_to_revision:
            common.fetch_missing_resultsets("running", missing_resultsets, logger)

        return th_collections


class Builds4hJobsProcess(JsonExtractorMixin,
                          Builds4hTransformerMixin,
                          OAuthLoaderMixin):
    def run(self, filter_to_revision=None, filter_to_project=None):
        extracted_content = self.extract(settings.BUILDAPI_BUILDS4H_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content,
                               filter_to_revision=filter_to_revision,
                               filter_to_project=filter_to_project)
            )


class PendingJobsProcess(JsonExtractorMixin,
                         PendingTransformerMixin,
                         OAuthLoaderMixin):
    def run(self, filter_to_revision=None, filter_to_project=None):
        extracted_content = self.extract(settings.BUILDAPI_PENDING_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content,
                               filter_to_revision=filter_to_revision,
                               filter_to_project=filter_to_project)
            )


class RunningJobsProcess(JsonExtractorMixin,
                         RunningTransformerMixin,
                         OAuthLoaderMixin):
    def run(self, filter_to_revision=None, filter_to_project=None):
        extracted_content = self.extract(settings.BUILDAPI_RUNNING_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content,
                               filter_to_revision=filter_to_revision,
                               filter_to_project=filter_to_project)
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

                deserialized_data = {}
                if data:
                    deserialized_data = json.loads(data)

                self.report_obj['guids'] = deserialized_data.get('guids', {})

                if 'analyzers' in deserialized_data:
                    for analysis_type in deserialized_data['analyzers']:
                        self.report_obj['analyzers'][analysis_type]['data'] = \
                            deserialized_data['analyzers'][analysis_type]

    def get_blacklist(self):

        if os.path.isfile(self.builds4h_blacklist_file_path):
            with open(self.builds4h_blacklist_file_path) as f:
                data = f.read()

                deserialized_data = []
                if data:
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
