import logging
from collections import defaultdict

import simplejson as json
from django.conf import settings
from django.core.cache import cache

from treeherder.client import TreeherderJobCollection
from treeherder.etl import (buildbot,
                            common)
from treeherder.etl.mixins import (ClientLoaderMixin,
                                   JsonExtractorMixin)
from treeherder.model.models import Datasource

logger = logging.getLogger(__name__)
CACHE_KEYS = {
    'pending': 'processed_buildapi_pending',
    'running': 'processed_buildapi_running',
    'complete': 'processed_buildapi_complete',
}


class Builds4hTransformerMixin(object):

    def find_job_guid(self, build):
        """
        returns the job_guid, based on request id and request time.
        necessary because request id and request time is inconsistently
        represented in builds4h
        """

        # this is reused in the transformer and the analyzer, so reverting
        # the field getters to this function.

        prop = build['properties']

        try:
            # request_ids can be found in a couple of different places
            request_ids = prop.get('request_ids', build['request_ids'])
            # By experimentation we've found that the last id in the list
            # corresponds to the request that was used to schedule the job.
            request_id = request_ids[-1]
        except KeyError as e:
            logger.error("({0})request_id not found in {1}".format(
                prop["branch"], build))
            raise e

        try:
            buildername = prop['buildername']
        except KeyError as e:
            logger.error("({0})buildername not found in {1}".format(
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

        job_guid_data = {'job_guid': '', 'coalesced': []}

        # If request_ids contains more than one element, then jobs were coalesced into
        # this one. In that case, the last element corresponds to the request id of
        # the job that actually ran (ie this one), and the rest are for the pending
        # jobs that were coalesced. We must generate guids for these coalesced jobs,
        # so they can be marked as coalesced, and not left as orphaned pending jobs.
        coalesced_requests = request_ids[:-1]
        for coalesced_request_id in coalesced_requests:
            job_guid_data['coalesced'].append(common.generate_job_guid(coalesced_request_id, buildername))

        job_guid_data['job_guid'] = common.generate_job_guid(request_id, buildername, endtime)

        return job_guid_data

    def transform(self, data, project_filter=None, revision_filter=None,
                  job_group_filter=None):
        """
        transform the builds4h structure into something we can ingest via
        our restful api
        """
        revisions = defaultdict(list)
        missing_resultsets = defaultdict(set)

        valid_projects = set(x.project for x in Datasource.objects.cached())

        for build in data['builds']:
            try:
                prop = build['properties']
                project = prop['branch']

                if common.should_skip_project(project, valid_projects, project_filter):
                    continue

                if common.should_skip_revision(prop['revision'], revision_filter):
                    continue

            except KeyError as e:
                logger.warning("skipping builds-4hr job %s since missing property: %s", build['id'], str(e))
                continue

            revisions[project].append(prop['revision'])

        revisions_lookup = common.lookup_revisions(revisions)

        job_ids_seen_last_time = cache.get(CACHE_KEYS['complete'], set())
        job_ids_seen_now = set()

        # Holds one collection per unique branch/project
        th_collections = {}

        for build in data['builds']:
            try:
                prop = build['properties']
                project = prop['branch']
                buildername = prop['buildername']
                if common.should_skip_project(project, valid_projects, project_filter):
                    continue
                if common.should_skip_revision(prop['revision'], revision_filter):
                    continue
                resultset = common.get_resultset(project,
                                                 revisions_lookup,
                                                 prop['revision'],
                                                 missing_resultsets,
                                                 logger)
            except KeyError:
                # There was no matching resultset, skip the job.
                continue

            # We record the id here rather than at the start of the loop, since we
            # must not count jobs whose revisions were not yet imported as processed,
            # or we'll never process them once we've ingested their associated revision.
            job_ids_seen_now.add(build['id'])

            # Don't process jobs that were already present in builds-4hr
            # the last time this task completed successfully.
            if build['id'] in job_ids_seen_last_time:
                continue

            platform_info = buildbot.extract_platform_info(buildername)
            job_name_info = buildbot.extract_name_info(buildername)

            if (job_group_filter and job_name_info.get('group_symbol', '').lower() !=
                    job_group_filter.lower()):
                continue

            treeherder_data = {
                'revision': prop['revision'],
                'resultset_id': resultset['id'],
                'project': project,
                'coalesced': []
            }

            log_reference = []
            if 'log_url' in prop:
                log_reference.append({
                    'url': prop['log_url'],
                    'name': 'buildbot_text'
                })

            # add structured logs to the list of log references
            if 'blobber_files' in prop:
                try:
                    blobber_files = json.loads(prop['blobber_files'])
                    for bf, url in blobber_files.items():
                        if bf and url and bf.endswith('_errorsummary.log'):
                            log_reference.append({
                                'url': url,
                                'name': 'errorsummary_json'
                            })
                except Exception as e:
                    logger.warning("invalid blobber_files json for build id %s (%s): %s",
                                   build['id'], buildername, e)

            try:
                job_guid_data = self.find_job_guid(build)
                # request_ids is mandatory, but can be found in several places.
                request_ids = prop.get('request_ids', build['request_ids'])
                # The last element in request_ids corresponds to the request id of this job,
                # the others are for the requests that were coalesced into this one.
                request_id = request_ids[-1]
            except KeyError:
                continue

            treeherder_data['coalesced'] = job_guid_data['coalesced']

            job = {
                'job_guid': job_guid_data['job_guid'],
                'name': job_name_info.get('name', ''),
                'job_symbol': job_name_info.get('job_symbol', ''),
                'group_name': job_name_info.get('group_name', ''),
                'group_symbol': job_name_info.get('group_symbol', ''),
                'reference_data_name': buildername,
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
                # pgo or non-pgo dependent on buildername parsing
                'option_collection': {
                    buildbot.extract_build_type(buildername): True
                },
                'log_references': log_reference,
                'artifacts': [
                    {
                        'type': 'json',
                        'name': 'buildapi',
                        'log_urls': [],
                        'blob': {
                            'buildername': buildername,
                            'request_id': request_id
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

        if missing_resultsets and not revision_filter:
            common.fetch_missing_resultsets("builds4h", missing_resultsets, logger)

        num_new_jobs = len(job_ids_seen_now.difference(job_ids_seen_last_time))
        logger.info("Imported %d completed jobs, skipped %d previously seen",
                    num_new_jobs, len(job_ids_seen_now) - num_new_jobs)

        return th_collections, job_ids_seen_now


class PendingRunningTransformerMixin(object):

    def transform(self, data, source, revision_filter=None, project_filter=None,
                  job_group_filter=None):
        """
        transform the buildapi structure into something we can ingest via
        our restful api
        """
        valid_projects = set(x.project for x in Datasource.objects.cached())
        revision_dict = defaultdict(list)
        missing_resultsets = defaultdict(set)

        # loop to catch all the revisions
        for project, revisions in data[source].iteritems():
            if common.should_skip_project(project, valid_projects, project_filter):
                continue

            for rev in revisions.iterkeys():
                if common.should_skip_revision(rev, revision_filter):
                    continue
                revision_dict[project].append(rev)

        # retrieving the revision->resultset lookups
        revisions_lookup = common.lookup_revisions(revision_dict)

        job_ids_seen_last_time = cache.get(CACHE_KEYS[source], set())
        job_ids_seen_now = set()

        th_collections = {}

        for project, revisions in data[source].iteritems():
            if common.should_skip_project(project, valid_projects, project_filter):
                continue

            for revision, jobs in revisions.items():
                if common.should_skip_revision(revision, revision_filter):
                    continue

                try:
                    resultset = common.get_resultset(project,
                                                     revisions_lookup,
                                                     revision,
                                                     missing_resultsets,
                                                     logger)
                except KeyError:
                    # There was no matching resultset, skip the job.
                    continue

                # using project and revision form the revision lookups
                # to filter those jobs with unmatched revision
                for job in jobs:
                    job_ids_seen_now.add(job['id'])

                    # Don't process jobs that were already present in this datasource
                    # the last time this task completed successfully.
                    if job['id'] in job_ids_seen_last_time:
                        continue

                    treeherder_data = {
                        'revision': revision,
                        'resultset_id': resultset['id'],
                        'project': project,
                    }

                    buildername = job['buildername']
                    platform_info = buildbot.extract_platform_info(buildername)
                    job_name_info = buildbot.extract_name_info(buildername)

                    if (job_group_filter and job_name_info.get('group_symbol', '').lower() !=
                            job_group_filter.lower()):
                        continue

                    if source == 'pending':
                        request_id = job['id']
                    elif source == 'running':
                        # The last element in request_ids corresponds to the request id of this job,
                        # the others are for the requests that were coalesced into this one.
                        request_id = job['request_ids'][-1]

                    new_job = {
                        'job_guid': common.generate_job_guid(
                            request_id,
                            buildername
                        ),
                        'name': job_name_info.get('name', ''),
                        'job_symbol': job_name_info.get('job_symbol', ''),
                        'group_name': job_name_info.get('group_name', ''),
                        'group_symbol': job_name_info.get('group_symbol', ''),
                        'reference_data_name': buildername,
                        'state': source,
                        'submit_timestamp': job['submitted_at'],
                        'build_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                        },
                        # where are we going to get this data from?
                        'machine_platform': {
                            'os_name': platform_info['os'],
                            'platform': platform_info['os_platform'],
                            'architecture': platform_info['arch'],
                        },
                        'who': 'unknown',
                        'option_collection': {
                            # build_type contains an option name, eg. PGO
                            buildbot.extract_build_type(buildername): True
                        },
                        'log_references': [],
                        'artifacts': [
                            {
                                'type': 'json',
                                'name': 'buildapi',
                                'log_urls': [],
                                'blob': {
                                    'buildername': buildername,
                                    'request_id': request_id
                                }
                            },
                        ]
                    }

                    if source == 'running':
                        new_job['start_timestamp'] = job['start_time']
                        # We store the original values to help debugging.
                        new_job['artifacts'].append(
                            {
                                'type': 'json',
                                'name': 'buildapi_running',
                                'log_urls': [],
                                'blob': {
                                    'revision': revision,
                                    'request_ids': job['request_ids'],
                                    'submitted_at': job['submitted_at'],
                                    'start_time': job['start_time'],
                                }
                            }
                        )

                    treeherder_data['job'] = new_job

                    if project not in th_collections:
                        th_collections[project] = TreeherderJobCollection()

                    # get treeherder job instance and add the job instance
                    # to the collection instance
                    th_job = th_collections[project].get_job(treeherder_data)
                    th_collections[project].add(th_job)

        num_new_jobs = len(job_ids_seen_now.difference(job_ids_seen_last_time))
        logger.info("Imported %d %s jobs, skipped %d previously seen",
                    num_new_jobs, source, len(job_ids_seen_now) - num_new_jobs)

        return th_collections, job_ids_seen_now


class Builds4hJobsProcess(JsonExtractorMixin,
                          Builds4hTransformerMixin,
                          ClientLoaderMixin):

    def run(self, revision_filter=None, project_filter=None, job_group_filter=None):
        """ Returns True if new completed jobs were loaded, False otherwise. """
        extracted_content = self.extract(settings.BUILDAPI_BUILDS4H_URL)
        job_collections, job_ids_seen = self.transform(extracted_content,
                                                       revision_filter=revision_filter,
                                                       project_filter=project_filter,
                                                       job_group_filter=job_group_filter)
        if job_collections:
            self.load(job_collections, chunk_size=settings.BUILDAPI_BUILDS4H_CHUNK_SIZE)
        cache.set(CACHE_KEYS['complete'], job_ids_seen)
        return bool(job_collections)


class PendingJobsProcess(JsonExtractorMixin,
                         PendingRunningTransformerMixin,
                         ClientLoaderMixin):

    def run(self, revision_filter=None, project_filter=None, job_group_filter=None):
        """ Returns True if new pending jobs were loaded, False otherwise. """
        extracted_content = self.extract(settings.BUILDAPI_PENDING_URL)
        job_collections, job_ids_seen = self.transform(extracted_content,
                                                       'pending',
                                                       revision_filter=revision_filter,
                                                       project_filter=project_filter,
                                                       job_group_filter=job_group_filter)
        if job_collections:
            self.load(job_collections, chunk_size=settings.BUILDAPI_PENDING_CHUNK_SIZE)
        cache.set(CACHE_KEYS['pending'], job_ids_seen)
        return bool(job_collections)


class RunningJobsProcess(JsonExtractorMixin,
                         PendingRunningTransformerMixin,
                         ClientLoaderMixin):

    def run(self, revision_filter=None, project_filter=None, job_group_filter=None):
        """ Returns True if new running jobs were loaded, False otherwise. """
        extracted_content = self.extract(settings.BUILDAPI_RUNNING_URL)
        job_collections, job_ids_seen = self.transform(extracted_content,
                                                       'running',
                                                       revision_filter=revision_filter,
                                                       project_filter=project_filter,
                                                       job_group_filter=job_group_filter)
        if job_collections:
            self.load(job_collections, chunk_size=settings.BUILDAPI_RUNNING_CHUNK_SIZE)
        cache.set(CACHE_KEYS['running'], job_ids_seen)
        return bool(job_collections)
