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
from treeherder.client import TreeherderJobCollection

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

        request_ids_str = ",".join(map(str, request_ids))
        request_time_list = []

        if isinstance(request_times, dict):
            for request_id in request_ids:
                request_time_list.append(
                    request_times[str(request_id)])
            request_times_str = ','.join(
                map(str, request_time_list))
        else:
            request_times_str = str(request_times)

        job_guid_data = {'job_guid': '', 'coalesced': []}

        if len(request_ids) > 1:
            # coallesced job detected, generate the coalesced
            # job guids
            for index, r_id in enumerate(request_ids):
                # skip if buildbot doesn't have a matching number of ids and times
                if len(request_time_list) > index:
                    job_guid_data['coalesced'].append(
                        common.generate_job_guid(
                            str(r_id), request_time_list[index]))

        job_guid_data['job_guid'] = common.generate_job_guid(
            request_ids_str, request_times_str, endtime)

        return job_guid_data

    def transform(self, data, filter_to_project=None, filter_to_revision=None,
                  filter_to_job_group=None):
        """
        transform the builds4h structure into something we can ingest via
        our restful api
        """
        revisions = defaultdict(list)
        missing_resultsets = defaultdict(set)

        projects = set(x.project for x in Datasource.objects.cached())

        for build in data['builds']:
            prop = build['properties']

            if 'buildername' not in prop:
                logger.warning("skipping builds-4hr job since no buildername found")
                continue

            if 'branch' not in prop:
                logger.warning("skipping builds-4hr job since no branch found: %s", prop['buildername'])
                continue

            if prop['branch'] not in projects:
                # Fuzzer jobs specify a branch of 'idle', and we intentionally don't display them.
                if prop['branch'] != 'idle':
                    logger.warning("skipping builds-4hr job on unknown branch %s: %s", prop['branch'], prop['buildername'])
                continue

            if filter_to_project and prop['branch'] != filter_to_project:
                continue

            prop['revision'] = prop.get('revision',
                                        prop.get('got_revision',
                                                 prop.get('sourcestamp', None)))

            if not prop['revision']:
                logger.warning("skipping builds-4hr job since no revision found: %s", prop['buildername'])
                continue

            prop['revision'] = prop['revision'][0:12]

            if prop['revision'] == prop.get('l10n_revision', None):
                # Some l10n jobs specify the l10n repo revision under 'revision', rather
                # than the gecko revision. If we did not skip these, it would result in
                # fetch_missing_resultsets requests that were guaranteed to 404.
                # This needs to be fixed upstream in builds-4hr by bug 1125433.
                logger.warning("skipping builds-4hr job since revision refers to wrong repo: %s", prop['buildername'])
                continue

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

            platform_info = buildbot.extract_platform_info(prop['buildername'])
            job_name_info = buildbot.extract_name_info(prop['buildername'])

            if (filter_to_job_group and job_name_info.get('group_symbol', '').lower() !=
                    filter_to_job_group.lower()):
                continue

            treeherder_data = {
                'revision_hash': resultset['revision_hash'],
                'resultset_id': resultset['id'],
                'project': project,
                'coalesced': []
            }

            device_name = buildbot.get_device_or_unknown(
                job_name_info.get('name', ''),
                platform_info['vm']
            )

            log_reference = []
            if 'log_url' in prop:
                log_reference.append({
                    'url': prop['log_url'],
                    'name': 'buildbot_text'
                })

            # add structured logs to the list of log references
            if 'blobber_files' in prop:
                blobber_files = json.loads(prop['blobber_files'])
                for bf, url in blobber_files.items():
                    if bf and url and bf.endswith('_raw.log'):
                        log_reference.append({
                            'url': url,
                            'name': 'mozlog_json'
                        })

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
                # scheduler, if 'who' property is not present
                'who': prop.get('who', prop.get('scheduler', '')),
                'submit_timestamp': build['requesttime'],
                'start_timestamp': build['starttime'],
                'end_timestamp': build['endtime'],
                'machine': prop.get('slavename', 'unknown'),
                # build_url not present in all builds
                'build_url': prop.get('build_url', ''),
                # build_platform same as machine_platform
                'build_platform': {
                    # platform attributes sometimes parse without results
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
                # pgo or non-pgo dependent on buildername parsing
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
                            'request_id': max(request_ids)
                        }
                    },
                ]
            }

            treeherder_data['job'] = job

            if project not in th_collections:
                th_collections[project] = TreeherderJobCollection()

            # get treeherder job instance and add the job instance
            # to the collection instance
            th_job = th_collections[project].get_job(treeherder_data)
            th_collections[project].add(th_job)

        if missing_resultsets and not filter_to_revision:
            common.fetch_missing_resultsets("builds4h", missing_resultsets, logger)

        return th_collections


class PendingTransformerMixin(object):

    def transform(self, data, filter_to_revision=None, filter_to_project=None,
                  filter_to_job_group=None):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        source = 'pending'
        projects = set(x.project for x in Datasource.objects.cached())
        revision_dict = defaultdict(list)
        missing_resultsets = defaultdict(set)

        # loop to catch all the revisions
        for project, revisions in data[source].iteritems():
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

        for project, revisions in data[source].iteritems():

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
                for job in jobs:
                    treeherder_data = {
                        'revision_hash': resultset['revision_hash'],
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    platform_info = buildbot.extract_platform_info(job['buildername'])
                    job_name_info = buildbot.extract_name_info(job['buildername'])

                    if (filter_to_job_group and job_name_info.get('group_symbol', '').lower() !=
                            filter_to_job_group.lower()):
                        continue

                    request_id = job['id']
                    artifacts_request_id = request_id

                    device_name = buildbot.get_device_or_unknown(
                        job_name_info.get('name', ''),
                        platform_info['vm']
                    )

                    new_job = {
                        'job_guid': common.generate_job_guid(
                            request_id,
                            job['submitted_at']
                        ),
                        'name': job_name_info.get('name', ''),
                        'job_symbol': job_name_info.get('job_symbol', ''),
                        'group_name': job_name_info.get('group_name', ''),
                        'group_symbol': job_name_info.get('group_symbol', ''),
                        'reference_data_name': job['buildername'],
                        'state': source,
                        'submit_timestamp': job['submitted_at'],
                        'build_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },
                        # where are we going to get this data from?
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
                            buildbot.extract_build_type(job['buildername']): True
                        },
                        'log_references': [],
                        'artifacts': [
                            {
                                'type': 'json',
                                'name': 'buildapi_%s' % source,
                                'log_urls': [],
                                'blob': job
                            },
                            {
                                'type': 'json',
                                'name': 'buildapi',
                                'log_urls': [],
                                'blob': {
                                    'buildername': job['buildername'],
                                    'request_id': artifacts_request_id
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
            common.fetch_missing_resultsets(source, missing_resultsets, logger)

        return th_collections


class RunningTransformerMixin(object):

    def transform(self, data, filter_to_revision=None, filter_to_project=None,
                  filter_to_job_group=None):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        source = 'running'
        projects = set(x.project for x in Datasource.objects.cached())
        revision_dict = defaultdict(list)
        missing_resultsets = defaultdict(set)

        # loop to catch all the revisions
        for project, revisions in data[source].items():
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

        for project, revisions in data[source].items():

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
                for job in jobs:
                    treeherder_data = {
                        'revision_hash': resultset['revision_hash'],
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    platform_info = buildbot.extract_platform_info(job['buildername'])
                    job_name_info = buildbot.extract_name_info(job['buildername'])

                    if (filter_to_job_group and job_name_info.get('group_symbol', '').lower() !=
                            filter_to_job_group.lower()):
                        continue

                    request_id = job['request_ids'][0]
                    artifacts_request_id = max(job['request_ids'])

                    device_name = buildbot.get_device_or_unknown(
                        job_name_info.get('name', ''),
                        platform_info['vm']
                    )

                    new_job = {
                        'job_guid': common.generate_job_guid(
                            request_id,
                            job['submitted_at']
                        ),
                        'name': job_name_info.get('name', ''),
                        'job_symbol': job_name_info.get('job_symbol', ''),
                        'group_name': job_name_info.get('group_name', ''),
                        'group_symbol': job_name_info.get('group_symbol', ''),
                        'reference_data_name': job['buildername'],
                        'state': source,
                        'submit_timestamp': job['submitted_at'],
                        'build_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                            'vm': platform_info['vm']
                        },
                        # where are we going to get this data from?
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
                            buildbot.extract_build_type(job['buildername']): True
                        },
                        'log_references': [],
                        'artifacts': [
                            {
                                'type': 'json',
                                'name': 'buildapi_%s' % source,
                                'log_urls': [],
                                'blob': job
                            },
                            {
                                'type': 'json',
                                'name': 'buildapi',
                                'log_urls': [],
                                'blob': {
                                    'buildername': job['buildername'],
                                    'request_id': artifacts_request_id
                                }
                            },
                        ]
                    }

                    new_job['start_timestamp'] = job['start_time']

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
            common.fetch_missing_resultsets(source, missing_resultsets, logger)

        return th_collections


class Builds4hJobsProcess(JsonExtractorMixin,
                          Builds4hTransformerMixin,
                          OAuthLoaderMixin):

    def run(self, filter_to_revision=None, filter_to_project=None,
            filter_to_job_group=None):
        extracted_content = self.extract(settings.BUILDAPI_BUILDS4H_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content,
                               filter_to_revision=filter_to_revision,
                               filter_to_project=filter_to_project,
                               filter_to_job_group=filter_to_job_group)
            )


class PendingJobsProcess(JsonExtractorMixin,
                         PendingTransformerMixin,
                         OAuthLoaderMixin):

    def run(self, filter_to_revision=None, filter_to_project=None,
            filter_to_job_group=None):
        extracted_content = self.extract(settings.BUILDAPI_PENDING_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content,
                               filter_to_revision=filter_to_revision,
                               filter_to_project=filter_to_project,
                               filter_to_job_group=filter_to_job_group)
            )


class RunningJobsProcess(JsonExtractorMixin,
                         RunningTransformerMixin,
                         OAuthLoaderMixin):

    def run(self, filter_to_revision=None, filter_to_project=None,
            filter_to_job_group=None):
        extracted_content = self.extract(settings.BUILDAPI_RUNNING_URL)
        if extracted_content:
            self.load(
                self.transform(extracted_content,
                               filter_to_revision=filter_to_revision,
                               filter_to_project=filter_to_project,
                               filter_to_job_group=filter_to_job_group)
            )


class Builds4hAnalyzer(JsonExtractorMixin, Builds4hTransformerMixin):

    def __init__(self):
        # builds4h deserialized json
        self.raw_data = []
        self.blacklist = set([
            "fuzzer-linux",
            "fuzzer-macosx64-lion",
            "fuzzer-win64",
            "release-comm-esr24-final_verification",
            "release-comm-esr24-push_to_mirrors",
            "release-comm-esr24-ready_for_releasetest_testing",
            "release-comm-esr24-start_uptake_monitoring",
            "release-mozilla-beta-almost_ready_for_release",
            "release-mozilla-beta-android_repack_1/10",
            "release-mozilla-beta-android_repack_10/10",
            "release-mozilla-beta-android_repack_2/10",
            "release-mozilla-beta-android_repack_3/10",
            "release-mozilla-beta-android_repack_4/10",
            "release-mozilla-beta-android_repack_5/10",
            "release-mozilla-beta-android_repack_6/10",
            "release-mozilla-beta-android_repack_7/10",
            "release-mozilla-beta-android_repack_8/10",
            "release-mozilla-beta-android_repack_9/10",
            "release-mozilla-beta-antivirus",
            "release-mozilla-beta-fennec_source",
            "release-mozilla-beta-final_verification",
            "release-mozilla-beta-linux64_update_verify_3/6",
            "release-mozilla-beta-linux_update_verify_3/6",
            "release-mozilla-beta-linux_update_verify_6/6",
            "release-mozilla-beta-macosx64_update_verify_1/6",
            "release-mozilla-beta-macosx64_update_verify_2/6",
            "release-mozilla-beta-macosx64_update_verify_3/6",
            "release-mozilla-beta-macosx64_update_verify_4/6",
            "release-mozilla-beta-macosx64_update_verify_5/6",
            "release-mozilla-beta-macosx64_update_verify_6/6",
            "release-mozilla-beta-push_to_mirrors",
            "release-mozilla-beta-ready_for_releasetest_testing",
            "release-mozilla-beta-start_uptake_monitoring",
            "release-mozilla-beta-win32_update_verify_1/6",
            "release-mozilla-beta-win32_update_verify_2/6",
            "release-mozilla-beta-win32_update_verify_3/6",
            "release-mozilla-beta-win32_update_verify_4/6",
            "release-mozilla-beta-win32_update_verify_5/6",
            "release-mozilla-beta-win32_update_verify_6/6",
            "release-mozilla-esr24-postrelease",
            "Firefox mozilla-aurora linux l10n dep",
            "Firefox mozilla-aurora linux64 l10n dep",
            "Firefox mozilla-aurora macosx64 l10n dep",
            "Firefox mozilla-aurora win32 l10n dep",
            "Firefox mozilla-central linux l10n dep",
            "Firefox mozilla-central linux64 l10n dep",
            "Firefox mozilla-central macosx64 l10n dep",
            "Firefox mozilla-central win32 l10n dep",
            "Thunderbird comm-aurora linux l10n dep",
            "Thunderbird comm-aurora linux64 l10n dep",
            "Thunderbird comm-aurora macosx64 l10n dep",
            "Thunderbird comm-aurora win32 l10n dep",
            "Thunderbird comm-central linux l10n dep",
            "Thunderbird comm-central linux64 l10n dep",
            "Thunderbird comm-central macosx64 l10n dep",
            "Thunderbird comm-central win32 l10n dep",
            "Firefox birch win32 l10n nightly",
            "release-mozilla-beta-android-armv6_build",
            "release-mozilla-beta-android-x86_build",
            "release-mozilla-beta-android_build",
            "Firefox mozilla-central win32 l10n nightly"
        ])

        self.t_stamp = int(time.time())
        self.readable_time = datetime.datetime.fromtimestamp(
            self.t_stamp).strftime('%Y-%m-%d %H:%M:%S')

        # data structures for missing attributes
        self.report_obj = {
            'analyzers': {
                'branch_misses': {
                    'title': '{0} Objects Missing Branch Attribute',
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_branch_misses
                },
                'log_url_misses': {
                    'title': '{0} Objects Missing log_url Attribute',
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_log_url_misses
                },
                'slavename_misses': {
                    'title': '{0} Objects Missing slavename Attribute',
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_slavename_misses
                },
                'job_guid_misses': {
                    'title': '{0} Objects Missing Job Guids or Request Ids',
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_job_guid_misses,
                },
                'platform_regex_misses': {
                    'title': ('{0} Buildernames Not Found '
                              'By Platform Regular Expressions'),
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_platform_regex_misses,
                },
                'job_type_regex_misses': {
                    'title': ('{0} Buildernames Not Found By Job Type '
                              'Regular Expressions (Defaults to Build)'),
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_job_type_regex_misses,
                },
                'test_name_regex_misses': {
                    'title': ('{0} Buildernames Not Found By Test Name '
                              'Regular Expressions'),
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_test_name_regex_misses,
                },
                'revision_misses': {
                    'title': '{0} Objects Missing Revisions',
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_revision_misses,
                },
                'objects_missing_buildernames': {
                    'title': '{0} Objects With No Buildername',
                    'data': {},
                    'all_misses': 0,
                    'get_func': self.get_objects_missing_buildernames,
                },
            },
            'guids': {}
        }

        # load last analysis data
        self.data_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'treeherder',
            settings.MEDIA_ROOT
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

        # Add up all misses here
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

    def write_report(self):
        with open(self.builds4h_report_file_path, 'w') as report_fh:
            divider = "------------------------------------------------------\n"

            header_line = "Builds4h Report Last Run Time {0}\n".format(
                self.readable_time)
            report_fh.write(header_line)
            report_fh.write(divider)

            data_to_write = {'analyzers': {}, 'guids': {}}
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
                        key=lambda k_v: (k_v[1]['first_seen'], k_v[0])):

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

        # Write out the data json
        with open(self.builds4h_analysis_file_path, 'w') as f:
            f.write(json.dumps(data_to_write))

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
