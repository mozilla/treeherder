# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import simplejson as json
import MySQLdb
import time
import logging
import zlib
from collections import defaultdict
from datetime import datetime
from hashlib import sha1

from operator import itemgetter

from _mysql_exceptions import IntegrityError

from warnings import filterwarnings, resetwarnings
from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ObjectDoesNotExist

from treeherder.model.models import (Datasource,
                                     ExclusionProfile)

from treeherder.model import utils, error_summary
from treeherder.model.tasks import (publish_resultset,
                                    publish_job_action,
                                    populate_error_summary)

from treeherder.events.publisher import JobStatusPublisher

from treeherder.etl.common import get_guid_root

from .base import TreeherderModelBase, ObjectNotFoundException
from .artifacts import ArtifactsModel


logger = logging.getLogger(__name__)


class JobsModel(TreeherderModelBase):

    """
    Represent a job repository with objectstore

    content-types:
        jobs
        objectstore

    """

    # content types that every project will have
    CT_JOBS = "jobs"
    CT_OBJECTSTORE = "objectstore"

    INCOMPLETE_STATES = ["running", "pending"]
    STATES = INCOMPLETE_STATES + ["completed", "coalesced"]

    # indexes of specific items in the ``job_placeholder`` objects
    JOB_PH_JOB_GUID = 0
    JOB_PH_COALESCED_TO_GUID = 2
    JOB_PH_RESULT_SET_ID = 3
    JOB_PH_BUILD_PLATFORM_KEY = 4
    JOB_PH_MACHINE_PLATFORM_KEY = 5
    JOB_PH_MACHINE_NAME = 6
    JOB_PH_DEVICE_NAME = 7
    JOB_PH_OPTION_COLLECTION_HASH = 8
    JOB_PH_TYPE_KEY = 9
    JOB_PH_PRODUCT_TYPE = 10
    JOB_PH_WHO = 11
    JOB_PH_REASON = 12
    JOB_PH_RESULT = 13
    JOB_PH_STATE = 14
    JOB_PH_START_TIMESTAMP = 16
    JOB_PH_END_TIMESTAMP = 17
    JOB_PH_PENDING_AVG = 18
    JOB_PH_RUNNING_AVG = 19

    # list of searchable columns, i.e. those who have an index
    # it would be nice to get this directly from the db and cache it
    INDEXED_COLUMNS = {
        "job": {
            "id": "j.id",
            "job_guid": "j.job_guid",
            "job_coalesced_to_guid": "j.job_coalesced_to_guid",
            "result_set_id": "j.result_set_id",
            "build_platform_id": "j.build_platform_id",
            "build_system_type": "j.build_system_type",
            "machine_platform_id": "j.machine_platform_id",
            "machine_id": "j.machine_id",
            "option_collection_hash": "j.option_collection_hash",
            "job_type_id": "j.job_type_id",
            "product_id": "j.product_id",
            "failure_classification_id": "j.failure_classification_id",
            "who": "j.who",
            "reason": "j.reason",
            "result": "j.result",
            "state": "j.state",
            "submit_timestamp": "j.submit_timestamp",
            "start_timestamp": "j.start_timestamp",
            "end_timestamp": "j.end_timestamp",
            "last_modified": "j.last_modified",
            "signature": "j.signature",
            "tier": "j.tier"
        },
        "result_set": {
            "id": "rs.id",
            "revision_hash": "rs.revision_hash",
            "revision": "revision.revision",
            "author": "rs.author",
            "push_timestamp": "rs.push_timestamp"
        },
        "bug_job_map": {
            "job_id": "job_id",
            "bug_id": "bug_id",
            "type": "type",
            "who": "who",
            "submit_timestamp": "submit_timestamp"
        }
    }

    # jobs cycle targets
    # NOTE: There is an order dependency here, cycle_job and
    # cycle_result_set should be after any tables with foreign keys
    # to their ids.
    JOBS_CYCLE_TARGETS = [
        "jobs.deletes.cycle_job_artifact",
        "jobs.deletes.cycle_performance_artifact",
        "jobs.deletes.cycle_job_log_url",
        "jobs.deletes.cycle_job_note",
        "jobs.deletes.cycle_bug_job_map",
        "jobs.deletes.cycle_job",
        "jobs.deletes.cycle_revision",
        "jobs.deletes.cycle_revision_map",
        "jobs.deletes.cycle_result_set"
    ]

    @classmethod
    def create(cls, project, host=None, read_only_host=None):
        """
        Create all the datasource tables for this project.

        """

        if not host:
            host = settings.DATABASES['default']['HOST']
        if not read_only_host:
            read_only_host = settings.DATABASES['read_only']['HOST']

        for ct in [cls.CT_JOBS, cls.CT_OBJECTSTORE]:
            dataset = Datasource.get_latest_dataset(project, ct)
            source = Datasource(
                project=project,
                contenttype=ct,
                dataset=dataset or 1,
                host=host,
                read_only_host=read_only_host,
            )
            source.save()

        return cls(project=project)

    def get_jobs_dhub(self):
        """Get the dhub for jobs"""
        return self.get_dhub(self.CT_JOBS)

    def execute(self, data_type, **kwargs):
        """
        Execute a query based on the data_type provided.
        """
        if data_type == 'jobs':
            dhub = self.get_jobs_dhub()
        else:
            dhub = self.get_os_dhub()
        return utils.retry_execute(dhub, logger, **kwargs)

    def jobs_execute(self, **kwargs):
        return utils.retry_execute(self.get_jobs_dhub(), logger, **kwargs)

    ##################
    #
    # Job schema data methods
    #
    ##################

    def get_os_dhub(self):
        """Get the dhub for the objectstore"""
        return self.get_dhub(self.CT_OBJECTSTORE)

    def os_execute(self, **kwargs):
        return utils.retry_execute(self.get_os_dhub(), logger, **kwargs)

    def get_job(self, id):
        """Return the job row for this ``job_id``"""
        repl = [self.refdata_model.get_db_name()]
        data = self.jobs_execute(
            proc="jobs.selects.get_job",
            placeholders=[id],
            debug_show=self.DEBUG,
            replace=repl,
        )
        return data

    def get_job_reference_data(self, signature):
        # Retrieve associated data in reference_data_signatures
        result = self.refdata_model.get_reference_data([signature])
        if result and signature in result:
            return result[signature]

        return None

    def get_job_list(self, offset, limit,
                     conditions=None, exclusion_profile=None):
        """
        Retrieve a list of jobs. It's mainly used by the restful api to list
        the jobs. The conditions parameter is a dict containing a set of
        conditions for each key. e.g.:
        {
            'who': set([('=', 'john')]),
            'result': set([('IN', ("success", "retry"))])
        }
        """

        replace_str, placeholders = self._process_conditions(
            conditions, self.INDEXED_COLUMNS['job']
        )

        if exclusion_profile:
            try:
                if exclusion_profile is "default":
                    profile = ExclusionProfile.objects.get(
                        is_default=True
                    )
                else:
                    profile = ExclusionProfile.objects.get(
                        name=exclusion_profile
                    )
                signatures = profile.flat_exclusion[self.project]
                replace_str += " AND j.signature NOT IN ({0})".format(
                    ",".join(["%s"] * len(signatures))
                )
                placeholders += signatures
            except KeyError:
                # this repo/project has no hidden signatures
                pass
            except ExclusionProfile.DoesNotExist:
                # Either there's no default profile setup or the profile
                # specified is not availble
                pass

        repl = [self.refdata_model.get_db_name(), replace_str]
        data = self.jobs_execute(
            proc="jobs.selects.get_job_list",
            replace=repl,
            placeholders=placeholders,
            limit="{0},{1}".format(offset, limit),
            debug_show=self.DEBUG,
        )
        return data

    def set_state(self, job_id, state):
        """Update the state of an existing job"""
        self.jobs_execute(
            proc='jobs.updates.set_state',
            placeholders=[state, job_id],
            debug_show=self.DEBUG
        )

    def get_incomplete_job_guids(self, resultset_id):
        """Get list of ids for jobs of resultset that are not in complete state."""
        return self.jobs_execute(
            proc='jobs.selects.get_incomplete_job_guids',
            placeholders=[resultset_id],
            debug_show=self.DEBUG,
            return_type='dict',
            key_column='job_guid'
        )

    def cancel_all_resultset_jobs(self, requester, resultset_id):
        """Set all pending/running jobs in resultset to usercancel."""
        job_guids = list(self.get_incomplete_job_guids(resultset_id))
        jobs = self.get_job_ids_by_guid(job_guids).values()

        # Cancel all the jobs in the database...
        self.jobs_execute(
            proc='jobs.updates.cancel_all',
            placeholders=[resultset_id],
            debug_show=self.DEBUG
        )

        # Notify the build systems which created these jobs...
        for job in jobs:
            self._job_action_event(job, 'cancel', requester)

        # Notify the UI.
        status_publisher = JobStatusPublisher(settings.BROKER_URL)
        try:
            status_publisher.publish(job_guids, self.project, 'processed')
        finally:
            status_publisher.disconnect()

    def _job_action_event(self, job, action, requester):
        """
        Helper for issuing an 'action' for a given job (such as
        cancel/retrigger)

        :param job dict: The job which this action was issued to.
        :param action str: Name of the action (cancel, etc..).
        :param requester str: Email address of the user who caused action.
        """
        publish_job_action.apply_async(
            args=[self.project, action, job['id'], requester],
            routing_key='publish_to_pulse'
        )

    def retrigger(self, requester, job):
        """
        Issue a retrigger to the given job

        :param requester str: The email address associated with the user who
                              made this request
        :param job dict: A job object (typically a result of get_job)
        """
        self._job_action_event(job, 'retrigger', requester)

    def cancel_job(self, requester, job):
        """
        Cancel the given job and send an event to notify the build_system type
        who created it to do the actual work.

        :param requester str: The email address associated with the user who
                              made this request
        :param job dict: A job object (typically a result of get_job)
        """

        self._job_action_event(job, 'cancel', requester)

        self.jobs_execute(
            proc='jobs.updates.cancel_job',
            placeholders=[job['job_guid']],
            debug_show=self.DEBUG
        )
        status_publisher = JobStatusPublisher(settings.BROKER_URL)
        try:
            status_publisher.publish([job['job_guid']], self.project, 'processed')
        finally:
            status_publisher.disconnect()

    def get_log_references(self, job_id):
        """Return the log references for the given ``job_id``."""
        data = self.jobs_execute(
            proc="jobs.selects.get_log_references",
            placeholders=[job_id],
            debug_show=self.DEBUG,
        )
        return data

    def get_max_job_id(self):
        """Get the maximum job id."""
        data = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_max_job_id",
            debug_show=self.DEBUG,
        )
        return int(data[0]['max_id'] or 0)

    @staticmethod
    def get_performance_series_cache_key(project, interval_seconds,
                                         hash=False):
        key = 'performance-series-summary-%s-%s' % (project,
                                                    interval_seconds)
        if hash:
            key += '-hash'

        return key

    def get_performance_series_summary(self, interval_seconds):
        """
        Retrieve a summary of all of the property/value list pairs found
        in the series_signature table, organized by the signature summaries
        that they belong to.

        {
            'signature1': {
                            'property1': 'value1',
                            'property2': 'value2',
                            ...
                          },
            'signature2': {
                            'property1': 'value1',
                            'property2': 'value2',
                            ...
                          }
            ...
        }

        This data structure can be used to build a comprehensive set of
        options to browse all available performance data in a repository.
        """

        # Only retrieve signatures with property/values that have
        # received data for the time interval requested
        last_updated_limit = utils.get_now_timestamp() - interval_seconds

        cache_key = self.get_performance_series_cache_key(self.project,
                                                          interval_seconds)

        series_summary = cache.get(cache_key, None)
        if series_summary:
            series_summary = json.loads(zlib.decompress(series_summary))
        else:
            data = self.get_jobs_dhub().execute(
                proc="jobs.selects.get_perf_series_properties",
                placeholders=[last_updated_limit, interval_seconds],
                debug_show=self.DEBUG,
            )

            series_summary = defaultdict(dict)
            for datum in data:
                key, val = datum['property'], datum['value']
                if key == 'subtest_signatures':
                    val = json.loads(val)
                series_summary[datum['signature']][key] = val

            # HACK: take this out when we're using pylibmc and can use
            # compression automatically
            series_summary_json = json.dumps(series_summary)
            cache.set(cache_key, zlib.compress(series_summary_json))
            sha = sha1()
            sha.update(series_summary_json)
            hash_cache_key = self.get_performance_series_cache_key(
                self.project, interval_seconds, hash=True)
            cache.set(hash_cache_key, sha.hexdigest())

        return series_summary

    def get_job_note(self, id):
        """Return the job note by id."""
        data = self.jobs_execute(
            proc="jobs.selects.get_job_note",
            placeholders=[id],
            debug_show=self.DEBUG,
        )
        return data

    def get_job_note_list(self, job_id):
        """Return the job notes by job_id."""
        data = self.jobs_execute(
            proc="jobs.selects.get_job_note_list",
            placeholders=[job_id],
            debug_show=self.DEBUG,
        )
        return data

    def update_last_job_classification(self, job_id):
        """
        Update failure_classification_id no the job table accordingly to
        the latest annotation. If none is present it gets reverted to the
        default value
        """

        self.jobs_execute(
            proc='jobs.updates.update_last_job_classification',
            placeholders=[
                job_id,
            ],
            debug_show=self.DEBUG
        )

    def insert_job_note(self, job_id, failure_classification_id, who, note):
        """insert a new note for a job and updates its failure classification"""
        self.jobs_execute(
            proc='jobs.inserts.insert_note',
            placeholders=[
                job_id,
                failure_classification_id,
                who,
                note,
                utils.get_now_timestamp(),
            ],
            debug_show=self.DEBUG
        )
        self.update_last_job_classification(job_id)

    def delete_job_note(self, note_id, job_id):
        """
        Delete a job note and updates the failure classification for that job
        """

        self.jobs_execute(
            proc='jobs.deletes.delete_note',
            placeholders=[
                note_id,
            ],
            debug_show=self.DEBUG
        )

        self.update_last_job_classification(job_id)

    def insert_bug_job_map(self, job_id, bug_id, assignment_type, submit_timestamp, who):
        """
        Store a new relation between the given job and bug ids.
        """
        try:
            self.jobs_execute(
                proc='jobs.inserts.insert_bug_job_map',
                placeholders=[
                    job_id,
                    bug_id,
                    assignment_type,
                    submit_timestamp,
                    who
                ],
                debug_show=self.DEBUG
            )
        except IntegrityError as e:
            raise JobDataIntegrityError(e)

        if settings.MIRROR_CLASSIFICATIONS:
            job = self.get_job(job_id)[0]
            if job["state"] == "completed":
                # importing here to avoid an import loop
                from treeherder.etl.tasks import (submit_elasticsearch_doc,
                                                  submit_bugzilla_comment)
                # Submit bug associations to Bugzilla/Elasticsearch using async tasks.
                submit_elasticsearch_doc.apply_async(
                    args=[
                        self.project,
                        job_id,
                        bug_id,
                        submit_timestamp,
                        who
                    ],
                    routing_key='classification_mirroring'
                )
                submit_bugzilla_comment.apply_async(
                    args=[
                        self.project,
                        job_id,
                        bug_id,
                        who,
                    ],
                    routing_key='classification_mirroring'
                )

    def delete_bug_job_map(self, job_id, bug_id):
        """
        Delete a bug-job entry identified by bug_id and job_id
        """
        self.jobs_execute(
            proc='jobs.deletes.delete_bug_job_map',
            placeholders=[
                job_id,
                bug_id
            ],
            debug_show=self.DEBUG
        )

    def calculate_eta(self, sample_window_seconds, debug):

        # Get the most recent timestamp from jobs
        max_timestamp = self.jobs_execute(
            proc='jobs.selects.get_max_job_submit_timestamp',
            return_type='iter',
            debug_show=self.DEBUG
        ).get_column_data('submit_timestamp')

        if max_timestamp:

            time_window = int(max_timestamp) - sample_window_seconds

            eta_groups = self.jobs_execute(
                proc='jobs.selects.get_eta_groups',
                placeholders=[time_window],
                key_column='signature',
                return_type='dict',
                debug_show=self.DEBUG
            )

            placeholders = []
            submit_timestamp = int(time.time())
            for signature in eta_groups:

                pending_samples = map(
                    lambda x: int(x or 0),
                    eta_groups[signature]['pending_samples'].split(','))

                pending_median = self.get_median_from_sorted_list(
                    sorted(pending_samples))

                running_samples = map(
                    lambda x: int(x or 0),
                    eta_groups[signature]['running_samples'].split(','))

                running_median = self.get_median_from_sorted_list(
                    sorted(running_samples))

                placeholders.append(
                    [
                        signature,
                        'pending',
                        eta_groups[signature]['pending_avg_sec'],
                        pending_median,
                        eta_groups[signature]['pending_min_sec'],
                        eta_groups[signature]['pending_max_sec'],
                        eta_groups[signature]['pending_std'],
                        len(pending_samples),
                        submit_timestamp
                    ])

                placeholders.append(
                    [
                        signature,
                        'running',
                        eta_groups[signature]['running_avg_sec'],
                        running_median,
                        eta_groups[signature]['running_min_sec'],
                        eta_groups[signature]['running_max_sec'],
                        eta_groups[signature]['running_std'],
                        len(running_samples),
                        submit_timestamp
                    ])

            self.jobs_execute(
                proc='jobs.inserts.set_job_eta',
                placeholders=placeholders,
                executemany=True,
                debug_show=self.DEBUG
            )

    def get_median_from_sorted_list(self, sorted_list):

        length = len(sorted_list)

        if length == 0:
            return 0

        # Cannot take the median with only on sample,
        # return it
        elif length == 1:
            return sorted_list[0]

        elif not length % 2:
            return round(
                (sorted_list[length / 2] + sorted_list[length / 2 - 1]) / 2, 0
            )

        return round(sorted_list[length / 2], 0)

    def cycle_data(self, os_cycle_interval, cycle_interval, os_chunk_size, chunk_size, sleep_time):
        """Delete data older than cycle_interval, splitting the target data
into chunks of chunk_size size. Returns the number of result sets deleted"""

        os_max_timestamp = self._get_max_timestamp(os_cycle_interval)
        os_deletes = 0
        while True:
            self.os_execute(
                proc='objectstore.deletes.cycle_objectstore',
                placeholders=[os_max_timestamp, os_chunk_size],
                debug_show=self.DEBUG
            )
            rows_deleted = self.get_os_dhub().connection['master_host']['cursor'].rowcount
            os_deletes += rows_deleted
            if rows_deleted < os_chunk_size:
                break
            if sleep_time:
                # Allow some time for other queries to get through
                time.sleep(sleep_time)

        jobs_max_timestamp = self._get_max_timestamp(cycle_interval)
        # Retrieve list of result sets to delete
        result_set_data = self.jobs_execute(
            proc='jobs.selects.get_result_sets_to_cycle',
            placeholders=[jobs_max_timestamp],
            debug_show=self.DEBUG
        )
        if not result_set_data:
            return (os_deletes, 0)

        # group the result_set data in chunks
        result_set_chunk_list = zip(*[iter(result_set_data)] * chunk_size)
        # append the remaining result_set not fitting in a complete chunk
        result_set_chunk_list.append(
            result_set_data[-(len(result_set_data) % chunk_size):])

        for result_set_chunks in result_set_chunk_list:

            # Retrieve list of revisions associated with result sets
            rs_placeholders = [x['id'] for x in result_set_chunks]
            rs_where_in_clause = [','.join(['%s'] * len(rs_placeholders))]
            revision_data = self.jobs_execute(
                proc='jobs.selects.get_revision_ids_to_cycle',
                placeholders=rs_placeholders,
                replace=rs_where_in_clause,
                debug_show=self.DEBUG
            )

            # Retrieve list of jobs associated with result sets
            rev_placeholders = [x['revision_id'] for x in revision_data]
            rev_where_in_clause = [','.join(['%s'] * len(rev_placeholders))]
            job_data = self.jobs_execute(
                proc='jobs.selects.get_jobs_to_cycle',
                placeholders=rs_placeholders,
                replace=rs_where_in_clause,
                debug_show=self.DEBUG
            )

            job_guid_dict = dict((d['id'], d['job_guid']) for d in job_data)
            job_where_in_clause = [','.join(['%s'] * len(job_guid_dict))]

            # Associate placeholders and replace data with sql
            jobs_targets = []
            for proc in self.JOBS_CYCLE_TARGETS:
                query_name = proc.split('.')[-1]
                if query_name == 'cycle_revision':
                    jobs_targets.append({
                        "proc": proc,
                        "placeholders": rev_placeholders,
                        "replace": rev_where_in_clause
                    })

                elif query_name == 'cycle_revision_map':
                    jobs_targets.append({
                        "proc": proc,
                        "placeholders": rs_placeholders,
                        "replace": rs_where_in_clause
                    })

                elif query_name == 'cycle_result_set':
                    jobs_targets.append({
                        "proc": proc,
                        "placeholders": rs_placeholders,
                        "replace": rs_where_in_clause
                    })

                else:
                    jobs_targets.append({
                        "proc": proc,
                        "placeholders": job_guid_dict.keys(),
                        "replace": job_where_in_clause
                    })

            # remove data from specified jobs tables that is older than max_timestamp
            self._execute_table_deletes(jobs_targets, 'jobs', sleep_time)

        return (os_deletes, len(result_set_data))

    def _get_max_timestamp(self, cycle_interval):
        max_date = datetime.now() - cycle_interval
        return int(time.mktime(max_date.timetuple()))

    def _execute_table_deletes(self, sql_to_execute, data_type, sleep_time):

        for sql_obj in sql_to_execute:

            if not sql_obj['placeholders']:
                continue
            sql_obj['debug_show'] = self.DEBUG

            # Disable foreign key checks to improve performance
            self.execute(data_type,
                         proc='generic.db_control.disable_foreign_key_checks',
                         debug_show=self.DEBUG)

            self.execute(data_type, **sql_obj)
            self.get_dhub(data_type).commit('master_host')

            # Re-enable foreign key checks to improve performance
            self.execute(data_type,
                         proc='generic.db_control.enable_foreign_key_checks',
                         debug_show=self.DEBUG)

            if sleep_time:
                # Allow some time for other queries to get through
                time.sleep(sleep_time)

    def get_bug_job_map_list(self, offset, limit, conditions=None):
        """
        Retrieve a list of bug_job_map entries. The conditions parameter is a
        dict containing a set of conditions for each key. e.g.:
        {
            'job_id': set([('IN', (1, 2))])
        }
        """

        replace_str, placeholders = self._process_conditions(
            conditions, self.INDEXED_COLUMNS['bug_job_map']
        )

        repl = [replace_str]

        proc = "jobs.selects.get_bug_job_map_list"

        data = self.jobs_execute(
            proc=proc,
            replace=repl,
            placeholders=placeholders,
            limit="{0},{1}".format(offset, limit),
            debug_show=self.DEBUG,
        )
        return data

    def get_result_set_ids(self, revision_hashes, where_in_list):
        """Return the  a dictionary of revision_hash to id mappings given
           a list of revision_hashes and a where_in_list.

            revision_hashes = [ revision_hash1, revision_hash2, ... ]
            where_in_list = [ %s, %s, %s ... ]

            returns:

            {
              revision_hash1:{id: id1, push_timestamp: pt1},
              revision_hash2:{id: id2, push_timestamp: pt2},
              ...
                }
            """
        result_set_id_lookup = {}

        if revision_hashes:
            result_set_id_lookup = self.jobs_execute(
                proc='jobs.selects.get_result_set_ids',
                placeholders=revision_hashes,
                replace=[where_in_list],
                debug_show=self.DEBUG,
                key_column='revision_hash',
                return_type='dict')

        return result_set_id_lookup

    def get_result_set_list_by_ids(self, result_set_ids):

        conditions = {'id': set([('IN', tuple(result_set_ids))])}

        replace_str, placeholders = self._process_conditions(
            conditions, self.INDEXED_COLUMNS['result_set']
        )

        proc = "jobs.selects.get_result_set_list_by_ids"

        result_set_ids = self.jobs_execute(
            proc=proc,
            replace=[replace_str],
            placeholders=placeholders,
            debug_show=self.DEBUG,
        )

        aggregate_details = self.get_result_set_details(result_set_ids)

        return_list = self._merge_result_set_details(
            result_set_ids, aggregate_details, True)

        return return_list

    def get_result_set_list(
            self, offset_id, limit, full=True, conditions=None):
        """
        Retrieve a list of ``result_sets`` (also known as ``pushes``)
        If ``full`` is set to ``True`` then return revisions, too.
        No jobs

        Mainly used by the restful api to list the pushes in the UI
        """
        replace_str, placeholders = self._process_conditions(
            conditions, self.INDEXED_COLUMNS['result_set']
        )

        # If a push doesn't have jobs we can just
        # message the user, it would save us a very expensive join
        # with the jobs table.

        # Retrieve the filtered/limited list of result sets
        proc = "jobs.selects.get_result_set_list"
        result_set_ids = self.jobs_execute(
            proc=proc,
            replace=[replace_str],
            placeholders=placeholders,
            limit=limit,
            debug_show=self.DEBUG,
        )

        aggregate_details = self.get_result_set_details(result_set_ids)

        return_list = self._merge_result_set_details(
            result_set_ids, aggregate_details, full)

        return return_list

    def _merge_result_set_details(self, result_set_ids, aggregate_details, full):

        # Construct the return dataset, include all revisions associated
        # with each result_set in the revisions attribute
        return_list = []
        for result in result_set_ids:

            detail = aggregate_details[result['id']][0]
            list_item = {
                "id": result['id'],
                "revision_hash": result['revision_hash'],
                "push_timestamp": result['push_timestamp'],
                "repository_id": detail['repository_id'],
                "revision": detail['revision'],
                "author": result['author'] or detail['author'],
                "revision_count": len(aggregate_details[result['id']])
            }
            # we only return the first 20 revisions.
            if full:
                list_item.update({
                    "comments": detail['comments'],
                    "revisions": aggregate_details[result['id']][:20]
                })
            return_list.append(list_item)

        return return_list

    def get_revision_resultset_lookup(self, revision_list):
        """
        Create a list of revision->resultset lookups from a list of revision

        This will retrieve non-active resultsets as well.  Some of the data
        ingested has mixed up revisions that show for jobs, but are not in
        the right repository in builds4hr/running/pending.  So we ingest those
        bad resultsets/revisions as non-active so that we don't keep trying
        to re-ingest them.  Allowing this query to retrieve non ``active``
        resultsets means we will avoid re-doing that work by detacting that
        we've already ingested it.

        But we skip ingesting the job, because the resultset is not active.
        """

        replacement = ",".join(["%s"] * len(revision_list))
        replacement = " AND revision IN (" + replacement + ") "

        proc = "jobs.selects.get_revision_resultset_lookup"
        lookups = self.jobs_execute(
            proc=proc,
            placeholders=revision_list + [0, len(revision_list)],
            debug_show=self.DEBUG,
            replace=[replacement],
            return_type="dict",
            key_column="revision"
        )
        return lookups

    def get_resultset_revisions_list(self, result_set_id):
        """
        Return the revisions for the given resultset
        """

        proc = "jobs.selects.get_result_set_details"
        lookups = self.jobs_execute(
            proc=proc,
            debug_show=self.DEBUG,
            placeholders=[result_set_id],
            replace=["%s"],
        )
        return lookups

    def get_result_set_details(self, result_set_ids):
        """
        Retrieve all revisions associated with a set of ``result_set``
        (also known as ``pushes``) ids.

        Mainly used by the restful api to list the pushes and their associated
        revisions in the UI
        """

        if not result_set_ids:
            # No result sets provided
            return {}

        # Generate a list of result_set_ids
        ids = []
        id_placeholders = []
        for data in result_set_ids:
            id_placeholders.append('%s')
            ids.append(data['id'])

        where_in_clause = ','.join(id_placeholders)

        # Retrieve revision details associated with each result_set_id
        detail_proc = "jobs.selects.get_result_set_details"
        result_set_details = self.jobs_execute(
            proc=detail_proc,
            placeholders=ids,
            debug_show=self.DEBUG,
            replace=[where_in_clause],
        )

        # Aggregate the revisions by result_set_id
        aggregate_details = {}
        for detail in result_set_details:

            if detail['result_set_id'] not in aggregate_details:
                aggregate_details[detail['result_set_id']] = []

            aggregate_details[detail['result_set_id']].append(
                {
                    'revision': detail['revision'],
                    'author': detail['author'],
                    'repository_id': detail['repository_id'],
                    'comments': detail['comments'],
                    'commit_timestamp': detail['commit_timestamp']
                })

        return aggregate_details

    ##################
    #
    # Objectstore functionality
    #
    ##################

    def get_oauth_consumer_secret(self, key):
        """Consumer secret for oauth"""
        ds = self.get_datasource(self.CT_OBJECTSTORE)
        secret = ds.get_oauth_consumer_secret(key)
        return secret

    def store_job_data(self, json_data, error=None):
        """
        Write the JSON to the objectstore to be queued for processing.
        job_guid is needed in order to decide wether the object exists or not
        """

        loaded_timestamp = utils.get_now_timestamp()
        error = "N" if error is None else "Y"
        error_msg = error or ""

        obj_placeholders = []

        response = {}
        for job in json_data:
            try:
                json_job = json.dumps(job)
                job_guid = job['job']['job_guid']
            except Exception as e:

                emsg = u"Unknown error: {0}: {1}".format(
                    e.__class__.__name__, unicode(e))

                response[emsg] = job

            else:

                obj_placeholders.append(
                    [
                        loaded_timestamp,
                        job_guid,
                        json_job,
                        error,
                        error_msg,
                        job_guid
                    ])

        if obj_placeholders:
            # this query inserts the object if its guid is not present,
            # otherwise it does nothing
            self.os_execute(
                proc='objectstore.inserts.store_json',
                placeholders=obj_placeholders,
                executemany=True,
                debug_show=self.DEBUG
            )

        return response

    def retrieve_job_data(self, limit):
        """
        Retrieve JSON blobs from the objectstore.

        Does not claim rows for processing; should not be used for actually
        processing JSON blobs into jobs schema.

        Used only by the `transfer_data` management command.

        """
        proc = "objectstore.selects.get_unprocessed"
        json_blobs = self.os_execute(
            proc=proc,
            placeholders=[limit],
            debug_show=self.DEBUG,
            return_type='tuple'
        )

        return json_blobs

    def load_job_data(self, data, raise_errors=False):
        """
        Load JobData instances into jobs db, returns job_ids and any
        associated errors.

        Example:
        [
            {
                id: 1,
                json_blob:
                {
                    "revision_hash": "24fd64b8251fac5cf60b54a915bffa7e51f636b5",
                    "job": {
                        "build_platform": {
                            "platform": "Ubuntu VM 12.04",
                            "os_name": "linux",
                            "architecture": "x86_64",
                            "vm": true
                        },
                        "submit_timestamp": 1365732271,
                        "start_timestamp": "20130411165317",

                        "name": "xpcshell",

                        "device_name": "vm",

                        "job_symbol": "XP",

                        "group_name": "Shelliness",

                        "group_symbol": "XPC",

                        "option_collection": {
                            "opt": true
                        },
                        "log_references": [
                            {
                                "url": "http://ftp.mozilla.org/pub/...",
                                "name": "unittest"
                            }
                        ],
                        "who": "sendchange-unittest",
                        "reason": "scheduler",
                        artifacts:[{
                            type:" json | img | ...",
                            name:"",
                            log_urls:[
                                ]
                            blob:""
                        }],
                        "machine_platform": {
                            "platform": "Ubuntu VM 12.04",
                            "os_name": "linux",
                            "architecture": "x86_64",
                            "vm": true
                        },
                        "machine": "tst-linux64-ec2-314",
                        "state": "TODO",
                        "result": 0,
                        "job_guid": "d19375ce775f0dc166de01daa5d2e8a73a8e8ebf",
                        "product_name": "firefox",
                        "end_timestamp": "1365733932"
                    }

                }
            },
            ...
        ]

        """
        # Ensure that we have job data to process
        if not data:
            return

        # remove any existing jobs that already have the same state
        data = self._remove_existing_jobs(data)
        if not data:
            return

        # Structures supporting revision_hash SQL
        revision_hash_lookup = set()
        unique_revision_hashes = []
        rh_where_in = []

        # Structures supporting job SQL
        job_placeholders = []
        log_placeholders = []
        artifact_placeholders = []
        coalesced_job_guid_placeholders = []

        # List of json object ids and associated revision_hashes
        # loaded. Used to mark the status complete.
        object_placeholders = []

        retry_job_guids = []

        async_error_summary_list = []

        # get the tier-2 data signatures for this project.
        # if there are none, then just return an empty list
        tier_2_signatures = []
        try:
            tier_2 = ExclusionProfile.objects.get(name="Tier-2")
            # tier_2_blob = json.loads(tier_2['flat_exclusion'])
            tier_2_signatures = set(tier_2.flat_exclusion[self.project])
        except KeyError:
            # may be no tier 2 jobs for the current project
            # and that's ok.
            pass
        except ObjectDoesNotExist:
            # if this profile doesn't exist, then no second tier jobs
            # and that's ok.
            pass

        for datum in data:
            # Make sure we can deserialize the json object
            # without raising an exception
            try:
                if 'json_blob' in datum:
                    job_struct = JobData.from_json(datum['json_blob'])
                    revision_hash = job_struct['revision_hash']
                    job = job_struct['job']
                    coalesced = job_struct.get('coalesced', [])
                else:
                    job = datum['job']
                    revision_hash = datum['revision_hash']
                    coalesced = datum.get('coalesced', [])

                # TODO: Need a job structure validation step here. Now that
                # everything works in list context we cannot detect what
                # object is responsible for what error. If we validate here
                # we can capture the error and associate it with the object
                # and also skip it before generating any database errors.
            except JobDataError as e:
                if 'id' in datum:
                    self.mark_object_error(datum['id'], str(e))
                if raise_errors:
                    raise e
                continue
            except Exception as e:
                if 'id' in datum:
                    self.mark_object_error(
                        datum['id'],
                        u"Unknown error: {0}: {1}".format(
                            e.__class__.__name__, unicode(e))
                    )
                if raise_errors:
                    raise e
                continue

            try:
                # json object can be successfully deserialized
                # load reference data
                job_guid = self._load_ref_and_job_data_structs(
                    job,
                    revision_hash,
                    revision_hash_lookup,
                    unique_revision_hashes,
                    rh_where_in,
                    job_placeholders,
                    log_placeholders,
                    artifact_placeholders,
                    retry_job_guids,
                    tier_2_signatures,
                    async_error_summary_list
                )

                if 'id' in datum:
                    object_placeholders.append(
                        [revision_hash, datum['id']]
                    )

                for coalesced_guid in coalesced:
                    coalesced_job_guid_placeholders.append(
                        # coalesced to guid, coalesced guid
                        [job_guid, coalesced_guid]
                    )
            except Exception as e:
                if 'id' in datum:
                    self.mark_object_error(
                        datum['id'],
                        u"Unknown error: {}: {}".format(
                            e.__class__.__name__, unicode(e))
                    )
                if raise_errors:
                    raise e

        # Store all reference data and retrieve associated ids
        id_lookups = self.refdata_model.set_all_reference_data()

        job_eta_times = self.get_job_eta_times(
            id_lookups['reference_data_signatures']
        )

        # Store all revision hashes and retrieve result_set_ids
        result_set_ids = self.get_result_set_ids(
            unique_revision_hashes, rh_where_in
        )

        job_update_placeholders = []
        job_guid_list = []
        job_guid_where_in_list = []
        push_timestamps = {}

        for index, job in enumerate(job_placeholders):

            # Replace reference data with their associated ids
            self._set_data_ids(
                index,
                job_placeholders,
                id_lookups,
                job_guid_list,
                job_guid_where_in_list,
                job_update_placeholders,
                result_set_ids,
                job_eta_times,
                push_timestamps
            )

        job_id_lookup = self._load_jobs(
            job_placeholders, job_guid_where_in_list, job_guid_list
        )

        # For each of these ``retry_job_guids`` the job_id_lookup will
        # either contain the retry guid, or the root guid (based on whether we
        # inserted, or skipped insertion to do an update).  So add in
        # whichever is missing.
        for retry_guid in retry_job_guids:
            retry_guid_root = get_guid_root(retry_guid)
            lookup_keys = job_id_lookup.keys()

            if retry_guid in lookup_keys:
                # this retry was inserted in the db at some point
                if retry_guid_root not in lookup_keys:
                    # the root isn't there because there was, for some reason,
                    # never a pending/running version of this job
                    retry_job = job_id_lookup[retry_guid]
                    job_id_lookup[retry_guid_root] = retry_job

            elif retry_guid_root in lookup_keys:
                # if job_id_lookup contains the root, then the insert
                # will have skipped, so we want to find that job
                # when looking for the retry_guid for update later.
                retry_job = job_id_lookup[retry_guid_root]
                job_id_lookup[retry_guid] = retry_job

        # Need to iterate over log references separately since they could
        # be a different length. Replace job_guid with id in log url
        # placeholders
        # need also to retrieve the updated status to distinguish between
        # failed and successful jobs
        job_results = dict((el[0], el[9]) for el in job_update_placeholders)

        self._load_log_urls(log_placeholders, job_id_lookup,
                            job_results)

        with ArtifactsModel(self.project) as artifacts_model:
            artifacts_model.load_job_artifacts(artifact_placeholders, job_id_lookup)

        # schedule the generation of ``Bug suggestions`` artifacts
        # asynchronously now that the jobs have been created
        if async_error_summary_list:
            populate_error_summary.apply_async(
                args=[self.project, async_error_summary_list, job_id_lookup],
                routing_key='error_summary'
            )

        # If there is already a job_id stored with pending/running status
        # we need to update the information for the complete job
        if job_update_placeholders:
            # replace job_guid with job_id
            for row in job_update_placeholders:
                row[-1] = job_id_lookup[
                    get_guid_root(row[-1])
                ]['id']

            self.jobs_execute(
                proc='jobs.updates.update_job_data',
                debug_show=self.DEBUG,
                placeholders=job_update_placeholders,
                executemany=True)

        # Mark job status
        self.mark_objects_complete(object_placeholders)

        # set the job_coalesced_to_guid column for any coalesced
        # job found
        if coalesced_job_guid_placeholders:
            self.jobs_execute(
                proc='jobs.updates.update_coalesced_guids',
                debug_show=self.DEBUG,
                placeholders=coalesced_job_guid_placeholders,
                executemany=True)

    def _remove_existing_jobs(self, data):
        """
        Remove jobs from data where we already have them in the same state.

        1. split the incoming jobs into pending, running and complete.
        2. fetch the ``job_guids`` from the db that are in the same state as they
           are in ``data``.
        3. build a new list of jobs in ``new_data`` that are not already in
           the db and pass that back.  It could end up empty at that point.

        """
        states = {
            'pending': [],
            'running': [],
            'completed': [],
        }
        data_idx = []
        new_data = []
        placeholders = []
        state_clauses = []

        for i, datum in enumerate(data):

            try:
                if 'json_blob' in datum:
                    job_struct = JobData.from_json(datum['json_blob'])
                    job = job_struct['job']
                else:
                    job = datum['job']

                job_guid = str(job['job_guid'])
                states[str(job['state'])].append(job_guid)

                # index this place in the ``data`` object
                data_idx.append(job_guid)

            except Exception:
                data_idx.append("skipped")
                # it will get caught later in ``load_job_data``
                # adding the guid as "skipped" will mean it won't be found
                # in the returned list of dup guids from the db.
                # This will cause the bad job to be re-added
                # to ``new_data`` so that the error can be handled
                # in ``load_job_data``.

        for state, guids in states.items():
            if guids:
                placeholders.append(state)
                placeholders.extend(guids)
                state_clauses.append(
                    "(`state` = %s AND `job_guid` IN ({0}))".format(
                        ",".join(["%s"] * len(guids))
                    )
                )

        replacement = ' OR '.join(state_clauses)

        if placeholders:
            existing_guids = self.jobs_execute(
                proc='jobs.selects.get_job_guids_in_states',
                placeholders=placeholders,
                replace=[replacement],
                key_column='job_guid',
                return_type='set',
                debug_show=self.DEBUG,
            )

            # build a new list of jobs without those we already have loaded
            for i, guid in enumerate(data_idx):
                if guid not in existing_guids:
                    new_data.append(data[i])

        return new_data

    def _load_ref_and_job_data_structs(
        self, job, revision_hash, revision_hash_lookup,
        unique_revision_hashes, rh_where_in, job_placeholders,
        log_placeholders, artifact_placeholders, retry_job_guids,
        tier_2_signatures, async_artifact_list
    ):
        """
        Take the raw job object after etl and convert it to job_placeholders.

        If the job is a ``retry`` the ``job_guid`` will have a special
        suffix on it.  But the matching ``pending``/``running`` job will not.
        So we append the suffixed ``job_guid`` to ``retry_job_guids``
        so that we can update the job_id_lookup later with the non-suffixed
        ``job_guid`` (root ``job_guid``). Then we can find the right
        ``pending``/``running`` job and update it with this ``retry`` job.
        """

        # Store revision_hash to support SQL construction
        # for result_set entry
        if revision_hash not in revision_hash_lookup:
            unique_revision_hashes.append(revision_hash)
            rh_where_in.append('%s')

        build_os_name = job.get(
            'build_platform', {}).get('os_name', 'unknown')
        build_platform = job.get(
            'build_platform', {}).get('platform', 'unknown')
        build_architecture = job.get(
            'build_platform', {}).get('architecture', 'unknown')

        build_platform_key = self.refdata_model.add_build_platform(
            build_os_name, build_platform, build_architecture
        )

        machine_os_name = job.get(
            'machine_platform', {}).get('os_name', 'unknown')
        machine_platform = job.get(
            'machine_platform', {}).get('platform', 'unknown')
        machine_architecture = job.get(
            'machine_platform', {}).get('architecture', 'unknown')

        machine_platform_key = self.refdata_model.add_machine_platform(
            machine_os_name, machine_platform, machine_architecture
        )

        option_collection_hash = self.refdata_model.add_option_collection(
            job.get('option_collection', [])
        )

        machine = job.get('machine', 'unknown')
        self.refdata_model.add_machine(
            machine,
            long(job.get("end_timestamp", time.time()))
        )

        device_name = job.get('device_name', 'unknown')
        self.refdata_model.add_device(device_name)

        job_type = job.get('name', 'unknown')
        job_symbol = job.get('job_symbol', 'unknown')

        group_name = job.get('group_name', 'unknown')
        group_symbol = job.get('group_symbol', 'unknown')

        job_type_key = self.refdata_model.add_job_type(
            job_type, job_symbol, group_name, group_symbol
        )

        product = job.get('product_name', 'unknown')
        if len(product.strip()) == 0:
            product = 'unknown'
        self.refdata_model.add_product(product)

        job_guid = job['job_guid']
        job_guid = job_guid[0:50]

        who = job.get('who') or 'unknown'
        who = who[0:50]

        reason = job.get('reason') or 'unknown'
        reason = reason[0:125]

        state = job.get('state') or 'unknown'
        state = state[0:25]

        if job.get('result', 'unknown') == 'retry':
            retry_job_guids.append(job_guid)

        build_system_type = job.get('build_system_type', 'buildbot')

        # Should be the buildername in the case of buildbot
        reference_data_name = job.get('reference_data_name', None)

        signature = self.refdata_model.add_reference_data_signature(
            reference_data_name, build_system_type, self.project,
            [build_system_type, self.project, build_os_name, build_platform, build_architecture,
             machine_os_name, machine_platform, machine_architecture,
             device_name, group_name, group_symbol, job_type, job_symbol,
             option_collection_hash]
        )

        tier = 2 if signature in tier_2_signatures else 1

        job_placeholders.append([
            job_guid,
            signature,
            None,                   # idx:2, job_coalesced_to_guid,
            revision_hash,          # idx:3, replace with result_set_id
            build_platform_key,     # idx:4, replace with build_platform_id
            machine_platform_key,   # idx:5, replace with machine_platform_id
            machine,                # idx:6, replace with machine_id
            device_name,            # idx:7, replace with device_id
            option_collection_hash,  # idx:8
            job_type_key,           # idx:9, replace with job_type_id
            product,                # idx:10, replace with product_id
            who,
            reason,
            job.get('result', 'unknown'),  # idx:13, this is typically an int
            state,
            self.get_number(job.get('submit_timestamp')),
            self.get_number(job.get('start_timestamp')),
            self.get_number(job.get('end_timestamp')),
            0,                      # idx:18, replace with pending_avg_sec
            0,                      # idx:19, replace with running_avg_sec
            tier,
            job_guid,
            get_guid_root(job_guid)  # will be the same except for ``retry`` jobs
        ])

        log_refs = job.get('log_references', [])
        if log_refs:
            for log in log_refs:
                name = log.get('name') or 'unknown'
                name = name[0:50]

                url = log.get('url') or 'unknown'
                url = url[0:255]

                # the parsing status of this log.  'pending' or 'parsed'
                parse_status = log.get('parse_status', 'pending')

                log_placeholders.append([job_guid, name, url, parse_status])

        artifacts = job.get('artifacts', [])

        if artifacts:
            # the artifacts in this list could be ones that should have
            # bug suggestions generated for them.  If so, queue them to be
            # scheduled for asynchronous generation.
            tls_list = error_summary.get_artifacts_that_need_bug_suggestions(
                artifacts)
            async_artifact_list.extend(tls_list)

            ArtifactsModel.populate_placeholders(artifacts,
                                                 artifact_placeholders,
                                                 job_guid)

        return job_guid

    def get_number(self, s):
        try:
            return long(s)
        except (ValueError, TypeError):
            return 0

    def _set_data_ids(
        self, index, job_placeholders, id_lookups,
        job_guid_list, job_guid_where_in_list, job_update_placeholders,
        result_set_ids, job_eta_times, push_timestamps
    ):
        """
        Supplant ref data with ids and create update placeholders

        Pending jobs should be updated, rather than created.

        ``job_placeholders`` are used for creating new jobs.

        ``job_update_placeholders`` are used for updating existing non-complete
        jobs
        """

        # Replace reference data with their ids
        job_guid = job_placeholders[index][
            self.JOB_PH_JOB_GUID]
        job_coalesced_to_guid = job_placeholders[index][
            self.JOB_PH_COALESCED_TO_GUID]
        revision_hash = job_placeholders[index][
            self.JOB_PH_RESULT_SET_ID]
        build_platform_key = job_placeholders[index][
            self.JOB_PH_BUILD_PLATFORM_KEY]
        machine_platform_key = job_placeholders[index][
            self.JOB_PH_MACHINE_PLATFORM_KEY]
        machine_name = job_placeholders[index][
            self.JOB_PH_MACHINE_NAME]
        device_name = job_placeholders[index][
            self.JOB_PH_DEVICE_NAME]
        option_collection_hash = job_placeholders[index][
            self.JOB_PH_OPTION_COLLECTION_HASH]
        job_type_key = job_placeholders[index][self.JOB_PH_TYPE_KEY]
        product_type = job_placeholders[index][self.JOB_PH_PRODUCT_TYPE]
        who = job_placeholders[index][self.JOB_PH_WHO]
        reason = job_placeholders[index][self.JOB_PH_REASON]
        result = job_placeholders[index][self.JOB_PH_RESULT]
        job_state = job_placeholders[index][self.JOB_PH_STATE]
        start_timestamp = job_placeholders[index][self.JOB_PH_START_TIMESTAMP]
        end_timestamp = job_placeholders[index][self.JOB_PH_END_TIMESTAMP]

        # Load job_placeholders

        # replace revision_hash with id
        result_set = result_set_ids[revision_hash]
        job_placeholders[index][
            self.JOB_PH_RESULT_SET_ID] = result_set['id']
        push_timestamps[result_set['id']] = result_set['push_timestamp']

        # replace build_platform_key with id
        build_platform_id = id_lookups['build_platforms'][build_platform_key]['id']
        job_placeholders[index][
            self.JOB_PH_BUILD_PLATFORM_KEY] = build_platform_id

        # replace machine_platform_key with id
        machine_platform_id = id_lookups['machine_platforms'][machine_platform_key]['id']
        job_placeholders[index][
            self.JOB_PH_MACHINE_PLATFORM_KEY] = machine_platform_id

        # replace machine with id
        job_placeholders[index][
            self.JOB_PH_MACHINE_NAME] = id_lookups['machines'][machine_name]['id']

        job_placeholders[index][
            self.JOB_PH_DEVICE_NAME] = id_lookups['devices'][device_name]['id']

        # replace job_type with id
        job_type_id = id_lookups['job_types'][job_type_key]['id']
        job_placeholders[index][self.JOB_PH_TYPE_KEY] = job_type_id

        # replace product_type with id
        job_placeholders[index][
            self.JOB_PH_PRODUCT_TYPE] = id_lookups['products'][product_type]['id']

        job_guid_list.append(job_guid)

        # for retry jobs, we may have a different job_guid than the root of job_guid
        # because retry jobs append a suffix for uniqueness (since the job_guid
        # won't be unique due to them all having the same request_id and request_time.
        # But there may be a ``pending`` or ``running`` job that this retry
        # should be updating, so make sure to add the root ``job_guid`` as well.
        job_guid_root = get_guid_root(job_guid)
        if job_guid != job_guid_root:
            job_guid_list.append(job_guid_root)

        job_guid_where_in_list.append('%s')

        reference_data_signature = job_placeholders[index][1]
        pending_avg_sec = job_eta_times.get(reference_data_signature, {}).get('pending', 0)
        running_avg_sec = job_eta_times.get(reference_data_signature, {}).get('running', 0)

        job_placeholders[index][self.JOB_PH_PENDING_AVG] = pending_avg_sec
        job_placeholders[index][self.JOB_PH_RUNNING_AVG] = running_avg_sec

        # Load job_update_placeholders
        if job_state != 'pending':

            job_update_placeholders.append([
                job_guid,
                job_coalesced_to_guid,
                result_set_ids[revision_hash]['id'],
                id_lookups['machines'][machine_name]['id'],
                option_collection_hash,
                id_lookups['job_types'][job_type_key]['id'],
                id_lookups['products'][product_type]['id'],
                who,
                reason,
                result,
                job_state,
                start_timestamp,
                end_timestamp,
                job_state,
                get_guid_root(job_guid)
            ])

    def _load_jobs(
        self, job_placeholders, job_guid_where_in_list, job_guid_list
    ):

        if not job_placeholders:
            return {}

        # Store job data
        self.jobs_execute(
            proc='jobs.inserts.create_job_data',
            debug_show=self.DEBUG,
            placeholders=job_placeholders,
            executemany=True)

        return self.get_job_ids_by_guid(job_guid_list)

    def get_job_eta_times(self, reference_data_signatures):

        eta_lookup = {}

        if len(reference_data_signatures) == 0:
            return eta_lookup

        rds_where_in_clause = ','.join(['%s'] * len(reference_data_signatures))

        job_eta_data = self.jobs_execute(
            proc='jobs.selects.get_last_eta_by_signatures',
            debug_show=self.DEBUG,
            replace=[rds_where_in_clause],
            placeholders=reference_data_signatures)

        for eta_data in job_eta_data:

            signature = eta_data['signature']
            state = eta_data['state']

            if signature not in eta_lookup:
                eta_lookup[signature] = {}

            if state not in eta_lookup[signature]:
                eta_lookup[signature][state] = {}

            eta_lookup[signature][state] = eta_data['avg_sec']

        return eta_lookup

    def get_job_ids_by_guid(self, job_guid_list):

        job_guid_where_in_clause = ",".join(["%s"] * len(job_guid_list))

        job_id_lookup = self.jobs_execute(
            proc='jobs.selects.get_job_ids_by_guids',
            debug_show=self.DEBUG,
            replace=[job_guid_where_in_clause],
            placeholders=job_guid_list,
            key_column='job_guid',
            return_type='dict')

        return job_id_lookup

    def _load_log_urls(self, log_placeholders, job_id_lookup,
                       job_results):

        # importing here to avoid an import loop
        from treeherder.log_parser.tasks import parse_log, parse_json_log

        tasks = []

        result_sets = []

        time_now = int(time.time())

        if log_placeholders:
            for index, log_ref in enumerate(log_placeholders):
                job_guid = log_ref[0]
                job_id = job_id_lookup[job_guid]['id']
                result = job_results[job_guid]
                result_set_id = job_id_lookup[job_guid]['result_set_id']
                result_sets.append(result_set_id)

                # Replace job_guid with id
                log_placeholders[index][0] = job_id
                log_placeholders[index].append(time_now)
                task = dict()

                # a log can be submitted already parsed.  So only schedule
                # a parsing task if it's ``pending``
                # the submitter is then responsible for submitting the
                # text_log_summary artifact
                if log_ref[3] == 'pending':
                    if log_ref[1] == 'mozlog_json':
                        # don't parse structured logs for passing tests
                        if result != 'success':
                            task['routing_key'] = 'parse_log.json'

                    else:
                        if result != 'success':
                            task['routing_key'] = 'parse_log.failures'
                        else:
                            task['routing_key'] = 'parse_log.success'

                if 'routing_key' in task:
                    task['job_guid'] = job_guid
                    task['log_url'] = log_ref[2]
                    task['result_set_id'] = result_set_id
                    task['check_errors'] = True
                    tasks.append(task)

            # Store the log references
            self.jobs_execute(
                proc='jobs.inserts.set_job_log_url',
                debug_show=self.DEBUG,
                placeholders=log_placeholders,
                executemany=True)

            # I need to find the jog_log_url ids
            # just inserted but there's no unique key.
            # Also, the url column is not indexed, so it's
            # not a good idea to search based on that.
            # I'm gonna retrieve the logs by job ids and then
            # use their url to create a map.

            job_ids = [j["id"] for j in job_id_lookup.values()]

            job_log_url_list = self.get_job_log_url_list(job_ids)

            log_url_lookup = dict([(jlu['url'], jlu)
                                   for jlu in job_log_url_list])

            for task in tasks:
                parse_log_task = parse_log
                if task['routing_key'] == "parse_log.json":
                    parse_log_task = parse_json_log

                parse_log_task.apply_async(
                    args=[
                        self.project,
                        log_url_lookup[task['log_url']],
                        task['job_guid'],
                    ],
                    kwargs={'check_errors': task['check_errors']},
                    routing_key=task['routing_key']
                )

    def get_job_log_url_detail(self, job_log_url_id):
        obj = self.jobs_execute(
            proc='jobs.selects.get_job_log_url_detail',
            debug_show=self.DEBUG,
            placeholders=[job_log_url_id])
        if len(obj) == 0:
            raise ObjectNotFoundException("job_log_url", id=job_log_url_id)
        return obj[0]

    def get_job_log_url_list(self, job_ids):
        """
        Return a list of logs belonging to the given job_id(s).
        """
        if len(job_ids) == 0:
            return []

        replacement = []
        id_placeholders = ["%s"] * len(job_ids)
        replacement.append(','.join(id_placeholders))

        data = self.jobs_execute(
            proc="jobs.selects.get_job_log_url_list",
            placeholders=job_ids,
            replace=replacement,
            debug_show=self.DEBUG,
        )
        return data

    def update_job_log_url_status(self, job_log_url_id,
                                  parse_status, parse_timestamp):

        self.jobs_execute(
            proc='jobs.updates.update_job_log_url',
            debug_show=self.DEBUG,
            placeholders=[parse_status, parse_timestamp, job_log_url_id])

    def get_performance_series_from_signatures(self, signatures, interval_seconds):

        repl = [','.join(['%s'] * len(signatures))]
        placeholders = signatures
        placeholders.append(str(interval_seconds))

        data = self.jobs_execute(
            proc="jobs.selects.get_performance_series_from_signatures",
            debug_show=self.DEBUG,
            placeholders=placeholders,
            replace=repl)

        data = [{"series_signature": x["series_signature"],
                 "blob": json.loads(x["blob"])} for x in data]

        return data

    def get_signatures_from_properties(self, props):

        props_where_repl = [
            ' OR '.join(['(`property`=%s AND `value`=%s)'] * len(props)),
            ' AND '.join(['COALESCE(SUM(`property`=%s AND `value`=%s), 0) > 0'] * len(props))]

        # convert to 1 dimensional list
        props = [el for x in props.items() for el in x]
        props.extend(props)

        signatures = self.jobs_execute(
            proc="jobs.selects.get_signatures_from_properties",
            debug_show=self.DEBUG,
            placeholders=props,
            replace=props_where_repl)

        if not signatures:
            return {"success": False}

        signatures = [x.get("signature") for x in signatures]

        signatures_repl = [','.join(['%s'] * len(signatures))]

        properties = self.jobs_execute(
            proc="jobs.selects.get_all_properties_of_signatures",
            debug_show=self.DEBUG,
            placeholders=signatures,
            replace=signatures_repl)

        ret = {}
        for d in properties:
            sig = d["signature"]

            ret[sig] = ret[sig] if sig in ret else {}
            ret[sig][d["property"]] = d["value"]

        return ret

    def get_signature_properties(self, signatures):
        signatures_repl = [','.join(['%s'] * len(signatures))]

        properties = self.jobs_execute(
            proc="jobs.selects.get_all_properties_of_signatures",
            debug_show=self.DEBUG,
            placeholders=signatures,
            replace=signatures_repl)

        sigdict = {}
        for property in properties:
            signature = property['signature']
            if not sigdict.get(signature):
                sigdict[signature] = {}

            (key, val) = (property['property'], property['value'])
            if key == 'subtest_signatures':
                val = json.loads(val)

            sigdict[signature][key] = val

        ret = []
        for signature in signatures:
            if not sigdict[signature]:
                return ObjectNotFoundException("signature", id=signature)
            ret.append(sigdict[signature])

        return ret

    def store_performance_series(
            self, t_range, series_type, signature, series_data):

        lock_string = "sps_{0}_{1}_{2}".format(
            t_range, series_type, signature)

        # Use MySQL GETLOCK function to gaurd against concurrent celery tasks
        # overwriting each other's blobs. The lock incorporates the time
        # interval and signature combination and is specific to a single
        # json blob.
        lock = self.jobs_execute(
            proc='generic.locks.get_lock',
            debug_show=self.DEBUG,
            placeholders=[lock_string, 60])

        if lock[0]['lock'] != 1:
            logger.error(
                'store_performance_series lock_string, '
                '{0}, timed out!'.format(lock_string)
            )
            return

        try:
            now_timestamp = int(time.time())

            # If we don't have this t_range/signature combination create it
            series_data_json = json.dumps(series_data)
            insert_placeholders = [
                t_range, signature, series_type, now_timestamp,
                series_data_json, t_range, signature
            ]

            self.jobs_execute(
                proc='jobs.inserts.set_performance_series',
                debug_show=self.DEBUG,
                placeholders=insert_placeholders)

            # delete any previous instance of the cached copy of the perf
            # series summary, since it's now out of date
            cache.delete(self.get_performance_series_cache_key(self.project,
                                                               t_range))

            # Retrieve and update the series
            performance_series = self.jobs_execute(
                proc='jobs.selects.get_performance_series',
                debug_show=self.DEBUG,
                placeholders=[t_range, signature])

            db_series_json = performance_series[0]['blob']

            # If they're equal this was the first time the t_range
            # and signature combination was stored, so there's nothing to
            # do
            if series_data_json != db_series_json:

                series = json.loads(db_series_json)
                push_timestamp_limit = now_timestamp - int(t_range)

                series.extend(series_data)

                sorted_series = sorted(
                    series, key=itemgetter('result_set_id'), reverse=True
                )

                filtered_series = filter(
                    lambda d: d['push_timestamp'] >= push_timestamp_limit,
                    sorted_series
                )

                if filtered_series:

                    filtered_series_json = json.dumps(filtered_series)
                    update_placeholders = [
                        now_timestamp, filtered_series_json,
                        t_range, signature
                    ]

                    self.jobs_execute(
                        proc='jobs.updates.update_performance_series',
                        debug_show=self.DEBUG,
                        placeholders=update_placeholders)

        except Exception as e:

            raise e

        finally:
            # Make sure we release the lock no matter what errors
            # are generated
            self.jobs_execute(
                proc='generic.locks.release_lock',
                debug_show=self.DEBUG,
                placeholders=[lock_string])

    def _get_last_insert_id(self, contenttype="jobs"):
        """Return last-inserted ID."""
        return self.get_dhub(contenttype).execute(
            proc='generic.selects.get_last_insert_id',
            debug_show=self.DEBUG,
            return_type='iter',
        ).get_column_data('id')

    def get_num_unprocessed_objects(self):
        data = self.os_execute(proc='objectstore.selects.get_num_unprocessed',
                               debug_show=self.DEBUG)
        return int(data[0]['count'])

    def process_objects(self, loadlimit, raise_errors=False):
        """Processes JSON blobs from the objectstore into jobs schema."""
        rows = self.claim_objects(loadlimit)
        # TODO: Need a try/except here insuring we mark
        # any objects in a suspended state as errored
        if rows:
            self.load_job_data(rows)

    def claim_objects(self, limit):
        """
        Claim & return up to ``limit`` unprocessed blobs from the objectstore.

        Returns a tuple of dictionaries with "json_blob" and "id" keys.

        May return more than ``limit`` rows if there are existing orphaned rows
        that were claimed by an earlier connection with the same connection ID
        but never completed.

        """
        proc_mark = 'objectstore.updates.mark_loading'
        proc_get = 'objectstore.selects.get_claimed'

        # Note: There is a bug in MySQL http://bugs.mysql.com/bug.php?id=42415
        # that causes the following warning to be generated in the production
        # environment:
        #
        # _mysql_exceptions.Warning: Unsafe statement written to the binary
        # log using statement format since BINLOG_FORMAT = STATEMENT. The
        # statement is unsafe because it uses a LIMIT clause. This is
        # unsafe because the set of rows included cannot be predicted.
        #
        # I have been unable to generate the warning in the development
        # environment because the warning is specific to the master/slave
        # replication environment which only exists in production.In the
        # production environment the generation of this warning is causing
        # the program to exit.
        #
        # The mark_loading SQL statement does execute an UPDATE/LIMIT but now
        # implements an "ORDER BY id" clause making the UPDATE
        # deterministic/safe.  I've been unsuccessful capturing the specific
        # warning generated without redirecting program flow control.  To
        # resolve the problem in production, we're disabling MySQLdb.Warnings
        # before executing mark_loading and then re-enabling warnings
        # immediately after.  If this bug is ever fixed in mysql this handling
        # should be removed. Holy Hackery! -Jeads
        filterwarnings('ignore', category=MySQLdb.Warning)

        # Note: this claims rows for processing. Failure to call load_job_data
        # on this data will result in some json blobs being stuck in limbo
        # until another worker comes along with the same connection ID.
        self.os_execute(
            proc=proc_mark,
            placeholders=[limit],
            debug_show=self.DEBUG,
        )

        resetwarnings()

        # Return all JSON blobs claimed by this connection ID (could possibly
        # include orphaned rows from a previous run).
        json_blobs = self.os_execute(
            proc=proc_get,
            debug_show=self.DEBUG,
            return_type='tuple'
        )

        return json_blobs

    def mark_objects_complete(self, object_placeholders):
        """ Call to database to mark the task completed

            object_placeholders = [
                [ revision_hash, object_id ],
                [ revision_hash, object_id ],
                ...
                ]
        """
        if object_placeholders:
            self.os_execute(
                proc="objectstore.updates.mark_complete",
                placeholders=object_placeholders,
                executemany=True,
                debug_show=self.DEBUG
            )

    def mark_object_error(self, object_id, error):
        """ Call to database to mark the task as errored """
        self.os_execute(
            proc="objectstore.updates.mark_error",
            placeholders=[error, object_id],
            debug_show=self.DEBUG
        )

    def get_json_blob_by_guid(self, guid):
        """retrieves a json_blob given its guid"""
        data = self.os_execute(
            proc="objectstore.selects.get_json_blob_by_guid",
            placeholders=[guid],
            debug_show=self.DEBUG,
        )
        return data

    def get_json_blob_list(self, offset, limit):
        """
        Retrieve JSON blobs from the objectstore.
        Mainly used by the restful api to list the last blobs stored
        """
        proc = "objectstore.selects.get_json_blob_list"
        json_blobs = self.os_execute(
            proc=proc,
            placeholders=[offset, limit],
            debug_show=self.DEBUG,
            return_type='tuple'
        )

        return json_blobs

    def store_result_set_data(self, result_sets):
        """
        Build single queries to add new result_sets, revisions, and
        revision_map for a list of result_sets.

        result_sets = [
            {
             "revision_hash": "8afdb7debc82a8b6e0d56449dfdf916c77a7bf80",
             "push_timestamp": 1378293517,
             "author": "some-sheriff@mozilla.com",
             "revisions": [
                {
                    "files": ["js/src/TraceLogging.h"],
                    "comment": "Bug 911954 - Add forward declaration of JSScript to TraceLogging.h, r=h4writer",
                    "repository": "test_treeherder",
                    "author": "John Doe <jdoe@mozilla.com>",
                    "branch": "default",
                    "revision": "2c25d2bbbcd6"
                    },
                ...
                ]
                },
            ...
            ]

        returns = {

            }
        """
        if not result_sets:
            return {}

        # result_set data structures
        revision_hash_placeholders = []
        unique_revision_hashes = []
        where_in_list = []

        # revision data structures
        repository_id_lookup = dict()
        revision_placeholders = []
        all_revisions = []
        rev_where_in_list = []

        # revision_map structures
        revision_to_rhash_lookup = dict()

        # TODO: Confirm whether we need to do a lookup in this loop in the
        #   memcache to reduce query overhead
        for result in result_sets:

            revision_hash_placeholders.append(
                [
                    result.get('author', 'unknown@somewhere.com'),
                    result['revision_hash'],
                    result['push_timestamp'],
                    result.get('active_status', 'active'),
                    result['revision_hash']
                ]
            )
            where_in_list.append('%s')
            unique_revision_hashes.append(result['revision_hash'])

            for rev_datum in result['revisions']:

                # Retrieve the associated repository id just once
                # and provide handling for multiple repositories
                if rev_datum['repository'] not in repository_id_lookup:
                    repository_id = self.refdata_model.get_repository_id(
                        rev_datum['repository']
                    )
                    repository_id_lookup[rev_datum['repository']] = repository_id

                # We may not have a commit timestamp in the push data
                commit_timestamp = rev_datum.get(
                    'commit_timestamp', None
                )

                # We may not have a comment in the push data
                comment = rev_datum.get(
                    'comment', None
                )

                # Convert the file list to a comma delimited string
                file_list = rev_datum.get(
                    'files', []
                )
                file_str = ','.join(file_list)

                repository_id = repository_id_lookup[rev_datum['repository']]
                revision_placeholders.append(
                    [rev_datum['revision'],
                     rev_datum['author'],
                     comment,
                     file_str,
                     commit_timestamp,
                     repository_id,
                     rev_datum['revision'],
                     repository_id]
                )

                all_revisions.append(rev_datum['revision'])
                rev_where_in_list.append('%s')
                revision_to_rhash_lookup[rev_datum['revision']] = result['revision_hash']

        # Retrieve a list of revision_hashes that have already been stored
        # in the list of unique_revision_hashes. Use it to determine the new
        # result_sets found to publish to pulse.
        where_in_clause = ','.join(where_in_list)
        result_set_ids_before = self.jobs_execute(
            proc='jobs.selects.get_result_set_ids',
            placeholders=unique_revision_hashes,
            replace=[where_in_clause],
            key_column='revision_hash',
            return_type='set',
            debug_show=self.DEBUG
        )

        # Insert new result sets
        self.jobs_execute(
            proc='jobs.inserts.set_result_set',
            placeholders=revision_hash_placeholders,
            executemany=True,
            debug_show=self.DEBUG
        )

        lastrowid = self.get_jobs_dhub().connection['master_host']['cursor'].lastrowid

        # Retrieve new and already existing result set ids
        result_set_id_lookup = self.jobs_execute(
            proc='jobs.selects.get_result_set_ids',
            placeholders=unique_revision_hashes,
            replace=[where_in_clause],
            key_column='revision_hash',
            return_type='dict',
            debug_show=self.DEBUG
        )

        # identify the newly inserted result sets
        result_set_ids_after = set(result_set_id_lookup.keys())
        inserted_result_sets = result_set_ids_after.difference(
            result_set_ids_before
        )

        inserted_result_set_ids = []

        # If cursor.lastrowid is > 0 rows were inserted on this
        # cursor. When new rows are inserted, determine the new
        # result_set ids and submit publish to pulse tasks.
        if inserted_result_sets and lastrowid > 0:

            for revision_hash in inserted_result_sets:
                inserted_result_set_ids.append(
                    result_set_id_lookup[revision_hash]['id']
                )

        # Insert new revisions
        self.jobs_execute(
            proc='jobs.inserts.set_revision',
            placeholders=revision_placeholders,
            executemany=True,
            debug_show=self.DEBUG
        )

        # Retrieve new revision ids
        rev_where_in_clause = ','.join(rev_where_in_list)
        revision_id_lookup = self.jobs_execute(
            proc='jobs.selects.get_revisions',
            placeholders=all_revisions,
            replace=[rev_where_in_clause],
            key_column='revision',
            return_type='dict',
            debug_show=self.DEBUG
        )

        # Build placeholders for revision_map
        revision_map_placeholders = []
        for revision in revision_id_lookup:

            revision_hash = revision_to_rhash_lookup[revision]
            revision_id = revision_id_lookup[revision]['id']
            result_set_id = result_set_id_lookup[revision_hash]['id']

            revision_map_placeholders.append(
                [revision_id,
                 result_set_id,
                 revision_id,
                 result_set_id]
            )

        # Insert new revision_map entries
        self.jobs_execute(
            proc='jobs.inserts.set_revision_map',
            placeholders=revision_map_placeholders,
            executemany=True,
            debug_show=self.DEBUG
        )

        if len(inserted_result_set_ids) > 0:
            # Queue an event to notify pulse of these new resultsets
            publish_resultset.apply_async(
                args=[self.project, inserted_result_set_ids],
                routing_key='publish_to_pulse'
            )

        return {
            'result_set_ids': result_set_id_lookup,
            'revision_ids': revision_id_lookup,
            'inserted_result_set_ids': inserted_result_set_ids
        }

    def get_revision_timestamp(self, rev):
        """Get the push timestamp of the resultset for a revision"""
        return self.get_revision_resultset_lookup([rev])[rev][
            "push_timestamp"
        ]

    def get_exclusion_profile_signatures(self, exclusion_profile):
        """Retrieve the reference data signatures associates to an exclusion profile"""
        signatures = []
        try:
            if exclusion_profile == "default":
                profile = ExclusionProfile.objects.get(
                    is_default=True
                )
            else:
                profile = ExclusionProfile.objects.get(
                    name=exclusion_profile
                )
            signatures = profile.flat_exclusion[self.project]
        except KeyError:
            # this repo/project has no hidden signatures
            pass
        except ExclusionProfile.DoesNotExist:
            # Either there's no default profile setup or the profile
            # specified is not availble
            pass
        return signatures

    def get_resultset_status(self, resultset_id, exclusion_profile="default"):
        """Retrieve an aggregated job count for the given resultset.
        If an exclusion profile is provided, the job counted will be filtered accordingly"""
        replace = []
        placeholders = [resultset_id]
        if exclusion_profile:
            signature_list = self.get_exclusion_profile_signatures(exclusion_profile)
            if signature_list:
                signatures_replacement = ",".join(["%s"] * len(signature_list))
                replace.append(
                    "AND signature NOT IN ({0})".format(signatures_replacement)
                )
                placeholders += signature_list

        resulset_status_list = self.jobs_execute(
            proc='jobs.selects.get_resultset_status',
            placeholders=placeholders,
            replace=replace,
            debug_show=self.DEBUG)
        num_coalesced = 0
        resultset_status_dict = {}
        for rs in resulset_status_list:
            num_coalesced += rs['num_coalesced'] if rs['num_coalesced'] else 0
            if rs['state'] == 'completed':
                resultset_status_dict[rs['result']] = int(rs['total']) - rs['num_coalesced']
            else:
                resultset_status_dict[rs['state']] = int(rs['total'])
        if num_coalesced:
            resultset_status_dict['coalesced'] = num_coalesced
        return resultset_status_dict


class JobDataError(ValueError):
    pass


class JobDataIntegrityError(IntegrityError):
    pass


class JobData(dict):

    """
    Encapsulates data access from incoming test data structure.

    All missing-data errors raise ``JobDataError`` with a useful
    message. Unlike regular nested dictionaries, ``JobData`` keeps track of
    context, so errors contain not only the name of the immediately-missing
    key, but the full parent-key context as well.

    """

    def __init__(self, data, context=None):
        """Initialize ``JobData`` with a data dict and a context list."""
        self.context = context or []
        super(JobData, self).__init__(data)

    @classmethod
    def from_json(cls, json_blob):
        """Create ``JobData`` from a JSON string."""
        try:
            data = json.loads(json_blob)
        except ValueError as e:
            raise JobDataError("Malformed JSON: {0}".format(e))

        return cls(data)

    def __getitem__(self, name):
        """Get a data value, raising ``JobDataError`` if missing."""
        full_context = list(self.context) + [name]

        try:
            value = super(JobData, self).__getitem__(name)
        except KeyError:
            raise JobDataError("Missing data: {0}.".format(
                "".join(["['{0}']".format(c) for c in full_context])))

        # Provide the same behavior recursively to nested dictionaries.
        if isinstance(value, dict):
            value = self.__class__(value, full_context)

        return value
