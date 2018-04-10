import logging
import traceback
from collections import defaultdict

import newrelic.agent
import simplejson as json
from django.conf import settings
from django.core.cache import cache
from six import iteritems

from treeherder.client.thclient import TreeherderJobCollection
from treeherder.etl import (buildbot,
                            common)
from treeherder.etl.jobs import store_job_data
from treeherder.model.models import (Push,
                                     Repository)

logger = logging.getLogger(__name__)
CACHE_KEYS = {
    'pending': 'processed_buildapi_pending',
    'running': 'processed_buildapi_running',
    'complete': 'processed_buildapi_complete',
}
ONE_HOUR_IN_SECONDS = 3600
FOUR_HOURS_IN_SECONDS = 14400

# Signature sets are for
# autoland
# mozilla-beta
# mozilla-central
# mozilla-esr52
# mozilla-inbound
# mozilla-release
# try
# and all project repos
TIER_SIGNATURES = {
    # mozilla-central
    '49f148889483d2b918968dc58a3dc128e0cf3bad': 2,
    'eca4450a7589f585abb6417e2ec50ec9f9222f30': 2,
    'a639fc8e9c851c23d8757ca4cc0bdf4f47191a8d': 2,
    'ece1657e1df7a7eccfad512ec42ca95c737c9967': 2,
    'd5d4966a6291e0d5038feb53706ce94815f2940f': 2,
    '168c3f4f8b6e86fa6c72a90a7594ca740773754a': 2,
    '68a10491197ebdb2e1fe7421948602e610756648': 2,
    '42e9a1ff1501fbd9c5bfc4ee2db3014ef9e03764': 2,
    'a4cc9dc681d9dee8d2b2e12473bd108e567f9a6e': 2,
    'd727b862b1e0d15051c2cf70d433b98405b9d24e': 2,
    '7910e346829fdaf579fba02e7bdd5bdb484b3328': 2,
    # mozilla-esr52
    '4226b6b3015e09de57c2d553584eba5057b7425e': 3,
    '4df5d64f9501123193b0b3cf4d2e9b3c84bc2076': 3,
    # mozilla-release
    '285c5e0ad301703887bde886e4fb539e34678692': 3,
    'effdff3f7ec01e57e53e97cdda9e3bbf0f243e44': 3,
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
        except KeyError:
            logger.error("(%s)request_id not found in %s", prop["branch"], build)
            raise

        try:
            buildername = prop['buildername']
        except KeyError:
            logger.error("(%s)buildername not found in %s", prop["branch"], build)
            raise

        endtime = None
        if buildbot.RESULT_DICT[build['result']] == 'retry':
            try:
                endtime = build['endtime']
            except KeyError:
                logger.error("(%s)endtime not found in %s", prop["branch"], build)
                raise

        job_guid_data = {'job_guid': '', 'superseded': []}

        # If request_ids contains more than one element, then jobs were superseded by
        # this one. In that case, the last element corresponds to the request id of
        # the job that actually ran (ie this one), and the rest are for the pending
        # jobs that were superseded. We must generate guids for these superseded jobs,
        # so they can be marked as superseded, and not left as orphaned pending jobs.
        superseded_requests = request_ids[:-1]
        for superseded_request_id in superseded_requests:
            job_guid_data['superseded'].append(common.generate_job_guid(superseded_request_id, buildername))

        job_guid_data['job_guid'] = common.generate_job_guid(request_id, buildername, endtime)

        return job_guid_data

    def transform(self, data, project_filter=None, revision_filter=None,
                  job_group_filter=None):
        """
        transform the builds4h structure into something we can ingest via
        our restful api
        """
        valid_projects = set(Repository.objects.values_list('name', flat=True))

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

        job_ids_seen_last_time = cache.get(CACHE_KEYS['complete'], set())
        job_ids_seen_now = set()
        revisions_seen_for_project = defaultdict(set)

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
            except KeyError:
                continue

            # it should be quite rare for a job to be ingested before a
            # revision, but it could happen
            revision = prop['revision']
            if (revision not in revisions_seen_for_project[project] and
                not Push.objects.filter(
                    repository__name=project,
                    revision__startswith=revision).exists()):
                logger.warning("skipping jobs since %s revision %s "
                               "not yet ingested", project, revision)
                continue
            revisions_seen_for_project[project].add(revision)

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
                'project': project,
                'superseded': []
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
                # the others are for the requests that were superseded by this one.
                request_id = request_ids[-1]
            except KeyError:
                continue

            treeherder_data['superseded'] = job_guid_data['superseded']

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
        valid_projects = set(Repository.objects.values_list('name', flat=True))
        revision_dict = defaultdict(list)

        # loop to catch all the revisions
        for project, revisions in iteritems(data[source]):
            if common.should_skip_project(project, valid_projects, project_filter):
                continue

            for rev in revisions:
                if common.should_skip_revision(rev, revision_filter):
                    continue
                revision_dict[project].append(rev)

        job_ids_seen_last_time = cache.get(CACHE_KEYS[source], set())
        job_ids_seen_now = set()

        th_collections = {}

        for project, revisions in iteritems(data[source]):
            if common.should_skip_project(project, valid_projects, project_filter):
                continue

            revisions_seen_now_for_project = set()

            for revision, jobs in revisions.items():
                if common.should_skip_revision(revision, revision_filter):
                    continue

                # it should be quite rare for a job to be ingested before a
                # revision, but it could happen
                if revision not in revisions_seen_now_for_project and \
                   not Push.objects.filter(repository__name=project,
                                           revision__startswith=revision).exists():
                    logger.warning("skipping jobs since %s revision %s "
                                   "not yet ingested", project, revision)
                    continue
                revisions_seen_now_for_project.add(revision)

                # using project and revision form the revision lookups
                # to filter those jobs with unmatched revision
                for job in jobs:
                    job_ids_seen_now.add(job['id'])

                    # Don't process jobs that we saw the last time this task
                    # completed successfully.
                    if job['id'] in job_ids_seen_last_time:
                        continue

                    treeherder_data = {
                        'revision': revision,
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
                        # the others are for the requests that were superseded by this one.
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


class Builds4hJobsProcess(Builds4hTransformerMixin):

    def run(self, revision_filter=None, project_filter=None, job_group_filter=None):
        """ Returns True if new completed jobs were loaded, False otherwise. """
        builds_4hr = common.fetch_json(settings.BUILDAPI_BUILDS4H_URL)
        job_collections, job_ids_seen = self.transform(builds_4hr,
                                                       revision_filter=revision_filter,
                                                       project_filter=project_filter,
                                                       job_group_filter=job_group_filter)
        if job_collections:
            store_jobs(job_collections,
                       chunk_size=settings.BUILDAPI_BUILDS4H_CHUNK_SIZE)
        cache.set(CACHE_KEYS['complete'], job_ids_seen, FOUR_HOURS_IN_SECONDS)
        return bool(job_collections)


class PendingJobsProcess(PendingRunningTransformerMixin):

    def run(self, revision_filter=None, project_filter=None, job_group_filter=None):
        """ Returns True if new pending jobs were loaded, False otherwise. """
        builds_pending = common.fetch_json(settings.BUILDAPI_PENDING_URL)
        job_collections, job_ids_seen = self.transform(builds_pending,
                                                       'pending',
                                                       revision_filter=revision_filter,
                                                       project_filter=project_filter,
                                                       job_group_filter=job_group_filter)
        if job_collections:
            store_jobs(job_collections,
                       chunk_size=settings.BUILDAPI_PENDING_CHUNK_SIZE)
        cache.set(CACHE_KEYS['pending'], job_ids_seen, ONE_HOUR_IN_SECONDS)
        return bool(job_collections)


class RunningJobsProcess(PendingRunningTransformerMixin):

    def run(self, revision_filter=None, project_filter=None, job_group_filter=None):
        """ Returns True if new running jobs were loaded, False otherwise. """
        builds_running = common.fetch_json(settings.BUILDAPI_RUNNING_URL)
        job_collections, job_ids_seen = self.transform(builds_running,
                                                       'running',
                                                       revision_filter=revision_filter,
                                                       project_filter=project_filter,
                                                       job_group_filter=job_group_filter)
        if job_collections:
            store_jobs(job_collections,
                       chunk_size=settings.BUILDAPI_RUNNING_CHUNK_SIZE)
        cache.set(CACHE_KEYS['running'], job_ids_seen, ONE_HOUR_IN_SECONDS)
        return bool(job_collections)


def store_jobs(job_collections, chunk_size):
    errors = []
    for repository_name, jobs in iteritems(job_collections):
        for collection in jobs.get_chunks(chunk_size=chunk_size):
            try:
                repository = Repository.objects.get(
                    name=repository_name)
                collection.validate()
                store_job_data(repository, collection.get_collection_data(),
                               TIER_SIGNATURES)
            except Exception:
                newrelic.agent.record_exception()
                errors.append({
                    "project": repository_name,
                    "collection": "job",
                    "message": traceback.format_exc()
                })

    if errors:
        raise common.CollectionNotStoredException(errors)
