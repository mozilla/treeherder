import logging
import time
from datetime import datetime

import simplejson as json
from _mysql_exceptions import IntegrityError
from django.conf import settings
from django.core.exceptions import ObjectDoesNotExist

from treeherder.etl.common import get_guid_root
from treeherder.events.publisher import JobStatusPublisher
from treeherder.model import (error_summary,
                              utils)
from treeherder.model.models import (Datasource,
                                     ExclusionProfile)
from treeherder.model.tasks import (populate_error_summary,
                                    publish_job_action,
                                    publish_resultset,
                                    publish_resultset_action)

from .artifacts import ArtifactsModel
from .base import (ObjectNotFoundException,
                   TreeherderModelBase)

logger = logging.getLogger(__name__)


class JobsModel(TreeherderModelBase):

    """
    Represent a job repository
    """

    INCOMPLETE_STATES = ["running", "pending"]
    STATES = INCOMPLETE_STATES + ["completed", "coalesced"]

    # indexes of specific items in the ``job_placeholder`` objects
    JOB_PH_JOB_GUID = 0
    JOB_PH_COALESCED_TO_GUID = 2
    JOB_PH_RESULT_SET_ID = 3
    JOB_PH_BUILD_PLATFORM_KEY = 4
    JOB_PH_MACHINE_PLATFORM_KEY = 5
    JOB_PH_MACHINE_NAME = 6
    JOB_PH_OPTION_COLLECTION_HASH = 7
    JOB_PH_TYPE_KEY = 8
    JOB_PH_PRODUCT_TYPE = 9
    JOB_PH_WHO = 10
    JOB_PH_REASON = 11
    JOB_PH_RESULT = 12
    JOB_PH_STATE = 13
    JOB_PH_START_TIMESTAMP = 15
    JOB_PH_END_TIMESTAMP = 16
    JOB_PH_RUNNING_AVG = 17

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
            "short_revision": "rs.short_revision",
            "long_revision": "rs.long_revision",
            "author": "rs.author",
            "push_timestamp": "rs.push_timestamp",
            "last_modified": "rs.last_modified"
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
        "jobs.deletes.cycle_job_log_url",
        "jobs.deletes.cycle_job_note",
        "jobs.deletes.cycle_bug_job_map",
        "jobs.deletes.cycle_job",
    ]

    @classmethod
    def create(cls, project):
        """
        Create all the datasource tables for this project.

        """

        source = Datasource(project=project)
        source.save()

        return cls(project=project)

    def execute(self, **kwargs):
        return utils.retry_execute(self.get_dhub(), logger, **kwargs)

    ##################
    #
    # Job schema data methods
    #
    ##################

    def get_job(self, id):
        """Return the job row for this ``job_id``"""
        repl = [self.refdata_model.get_db_name()]
        data = self.execute(
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
                     conditions=None, exclusion_profile=None,
                     visibility="included"):
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
                # NOT here means "not part of the exclusion profile"
                inclusion = "NOT" if visibility == "included" else ""

                replace_str += " AND j.signature {0} IN ({1})".format(
                    inclusion,
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
        data = self.execute(
            proc="jobs.selects.get_job_list",
            replace=repl,
            placeholders=placeholders,
            limit=limit,
            offset=offset,
            debug_show=self.DEBUG,
        )
        return data

    def get_job_list_sorted(self, offset, limit, conditions=None):
        replace_str, placeholders = self._process_conditions(
            conditions, self.INDEXED_COLUMNS['job']
        )
        repl = [self.refdata_model.get_db_name(), replace_str]
        data = self.execute(
            proc="jobs.selects.get_job_list_sorted",
            replace=repl,
            placeholders=placeholders,
            limit=limit,
            offset=offset,
            debug_show=self.DEBUG,
        )
        return data

    def set_state(self, job_id, state):
        """Update the state of an existing job"""
        self.execute(
            proc='jobs.updates.set_state',
            placeholders=[state, job_id],
            debug_show=self.DEBUG
        )

    def get_incomplete_job_guids(self, resultset_id):
        """Get list of ids for jobs of resultset that are not in complete state."""
        return self.execute(
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
        self.execute(
            proc='jobs.updates.cancel_all',
            placeholders=[resultset_id],
            debug_show=self.DEBUG
        )

        # Sending 'cancel_all' action to pulse. Right now there is no listener
        # for this, so we cannot remove 'cancel' action for each job below.
        publish_resultset_action.apply_async(
            args=[self.project, 'cancel_all', resultset_id, requester],
            routing_key='publish_to_pulse'
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

    def trigger_missing_resultset_jobs(self, requester, resultset_id, project):
        publish_resultset_action.apply_async(
            args=[self.project, "trigger_missing_jobs", resultset_id, requester],
            routing_key='publish_to_pulse'
        )

    def trigger_all_talos_jobs(self, requester, resultset_id, project, times):
        publish_resultset_action.apply_async(
            args=[self.project, "trigger_all_talos_jobs", resultset_id, requester, times],
            routing_key='publish_to_pulse'
        )

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

    def backfill(self, requester, job):
        """
        Issue a "backfill" to the underlying build_system_type by scheduling a
        pulse message.

        :param requester str: The email address associated with the user who
                              made this request
        :param job dict: A job object (typically a result of get_job)
        """
        self._job_action_event(job, 'backfill', requester)

    def cancel_job(self, requester, job):
        """
        Cancel the given job and send an event to notify the build_system type
        who created it to do the actual work.

        :param requester str: The email address associated with the user who
                              made this request
        :param job dict: A job object (typically a result of get_job)
        """

        self._job_action_event(job, 'cancel', requester)

        self.execute(
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
        data = self.execute(
            proc="jobs.selects.get_log_references",
            placeholders=[job_id],
            debug_show=self.DEBUG,
        )
        return data

    def get_max_job_id(self):
        """Get the maximum job id."""
        data = self.get_dhub().execute(
            proc="jobs.selects.get_max_job_id",
            debug_show=self.DEBUG,
        )
        return int(data[0]['max_id'] or 0)

    def get_job_note(self, id):
        """Return the job note by id."""
        data = self.execute(
            proc="jobs.selects.get_job_note",
            placeholders=[id],
            debug_show=self.DEBUG,
        )
        return data

    def get_job_note_list(self, job_id):
        """Return the job notes by job_id."""
        data = self.execute(
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

        self.execute(
            proc='jobs.updates.update_last_job_classification',
            placeholders=[
                job_id,
            ],
            debug_show=self.DEBUG
        )

    def insert_job_note(self, job_id, failure_classification_id, who, note):
        """insert a new note for a job and updates its failure classification"""
        self.execute(
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

        self.execute(
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
            self.execute(
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
                from treeherder.etl.tasks import submit_elasticsearch_doc
                # Submit bug associations to Elasticsearch using an async task.
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

    def delete_bug_job_map(self, job_id, bug_id):
        """
        Delete a bug-job entry identified by bug_id and job_id
        """
        self.execute(
            proc='jobs.deletes.delete_bug_job_map',
            placeholders=[
                job_id,
                bug_id
            ],
            debug_show=self.DEBUG
        )

    def calculate_eta(self, sample_window_seconds, debug):

        # Get the most recent timestamp from jobs
        max_timestamp = self.execute(
            proc='jobs.selects.get_max_job_submit_timestamp',
            return_type='iter',
            debug_show=self.DEBUG
        ).get_column_data('submit_timestamp')

        if max_timestamp:

            time_window = int(max_timestamp) - sample_window_seconds

            eta_groups = self.execute(
                proc='jobs.selects.get_eta_groups',
                placeholders=[time_window],
                key_column='signature',
                return_type='dict',
                debug_show=self.DEBUG
            )

            placeholders = []
            submit_timestamp = int(time.time())
            for signature in eta_groups:

                running_samples = map(
                    lambda x: int(x or 0),
                    eta_groups[signature]['running_samples'].split(','))

                running_median = self.get_median_from_sorted_list(
                    sorted(running_samples))

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

            self.execute(
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

    def cycle_data(self, cycle_interval, chunk_size, sleep_time):
        """Delete data older than cycle_interval, splitting the target data
into chunks of chunk_size size. Returns the number of result sets deleted"""

        jobs_max_timestamp = self._get_max_timestamp(cycle_interval)
        # Retrieve list of jobs to delete
        jobs_to_cycle = self.execute(
            proc='jobs.selects.get_jobs_to_cycle',
            placeholders=[jobs_max_timestamp],
            debug_show=self.DEBUG
        )
        if not jobs_to_cycle:
            return 0

        # group the job in chunks
        jobs_chunk_list = zip(*[iter(jobs_to_cycle)] * chunk_size)
        # append the remaining job data not fitting in a complete chunk
        jobs_chunk_list.append(
            jobs_to_cycle[-(len(jobs_to_cycle) % chunk_size):])

        for jobs_chunk in jobs_chunk_list:
            job_id_list = [d['id'] for d in jobs_chunk]
            job_where_in_clause = [','.join(['%s'] * len(job_id_list))]

            # Associate placeholders and replace data with sql
            jobs_targets = []
            for proc in self.JOBS_CYCLE_TARGETS:
                jobs_targets.append({
                    "proc": proc,
                    "placeholders": job_id_list,
                    "replace": job_where_in_clause
                })

            # remove data from specified jobs tables that is older than max_timestamp
            self._execute_table_deletes(jobs_targets, 'jobs', sleep_time)

        return len(jobs_to_cycle)

    def _get_max_timestamp(self, cycle_interval):
        max_date = datetime.now() - cycle_interval
        return int(time.mktime(max_date.timetuple()))

    def _execute_table_deletes(self, sql_to_execute, data_type, sleep_time):

        for sql_obj in sql_to_execute:

            if not sql_obj['placeholders']:
                continue
            sql_obj['debug_show'] = self.DEBUG

            # Disable foreign key checks to improve performance
            self.execute(
                proc='generic.db_control.disable_foreign_key_checks',
                debug_show=self.DEBUG)

            self.execute(**sql_obj)
            self.get_dhub().commit('master_host')

            # Re-enable foreign key checks to improve performance
            self.execute(
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

        data = self.execute(
            proc=proc,
            replace=repl,
            placeholders=placeholders,
            limit=limit,
            offset=offset,
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
            result_set_id_lookup = self.execute(
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

        result_set_ids = self.execute(
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
        result_set_ids = self.execute(
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
        resultsets means we will avoid re-doing that work by detecting that
        we've already ingested it.

        But we skip ingesting the job, because the resultset is not active.
        """

        replacement = ",".join(["%s"] * len(revision_list))
        replacement = " AND revision IN (" + replacement + ") "

        proc = "jobs.selects.get_revision_resultset_lookup"
        lookups = self.execute(
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
        lookups = self.execute(
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
        result_set_details = self.execute(
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
                })

        return aggregate_details

    def get_oauth_consumer_secret(self, key):
        """Consumer secret for oauth"""
        ds = self.get_datasource()
        secret = ds.get_oauth_consumer_secret(key)
        return secret

    def store_job_data(self, data, raise_errors=False):
        """
        Store JobData instances into jobs db

        Example:
        [
            {
                "revision_hash": "24fd64b8251fac5cf60b54a915bffa7e51f636b5",
                "job": {
                    "job_guid": "d19375ce775f0dc166de01daa5d2e8a73a8e8ebf",
                    "name": "xpcshell",
                    "desc": "foo",
                    "job_symbol": "XP",
                    "group_name": "Shelliness",
                    "group_symbol": "XPC",
                    "product_name": "firefox",
                    "state": "TODO",
                    "result": 0,
                    "reason": "scheduler",
                    "who": "sendchange-unittest",
                    "submit_timestamp": 1365732271,
                    "start_timestamp": "20130411165317",
                    "end_timestamp": "1365733932"
                    "machine": "tst-linux64-ec2-314",
                    "build_platform": {
                        "platform": "Ubuntu VM 12.04",
                        "os_name": "linux",
                        "architecture": "x86_64"
                    },
                    "machine_platform": {
                        "platform": "Ubuntu VM 12.04",
                        "os_name": "linux",
                        "architecture": "x86_64"
                    },
                    "option_collection": {
                        "opt": true
                    },
                    "log_references": [
                        {
                            "url": "http://ftp.mozilla.org/pub/...",
                            "name": "unittest"
                        }
                    ],
                    artifacts:[{
                        type:" json | img | ...",
                        name:"",
                        log_urls:[
                            ]
                        blob:""
                    }],
                },
                "coalesced": []
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
                job = datum['job']
                revision_hash = datum['revision_hash']
                coalesced = datum.get('coalesced', [])

                # TODO: Need a job structure validation step here. Now that
                # everything works in list context we cannot detect what
                # object is responsible for what error. If we validate here
                # we can capture the error and associate it with the object
                # and also skip it before generating any database errors.
            except JobDataError as e:
                if raise_errors:
                    raise e
                continue
            except Exception as e:
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

                for coalesced_guid in coalesced:
                    coalesced_job_guid_placeholders.append(
                        # coalesced to guid, coalesced guid
                        [job_guid, coalesced_guid]
                    )
            except Exception as e:
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
        push_timestamps = {}

        for index, job in enumerate(job_placeholders):

            # Replace reference data with their associated ids
            self._set_data_ids(
                index,
                job_placeholders,
                id_lookups,
                job_guid_list,
                job_update_placeholders,
                result_set_ids,
                job_eta_times,
                push_timestamps
            )

        job_id_lookup = self._load_jobs(job_placeholders, job_guid_list)

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

            self.execute(
                proc='jobs.updates.update_job_data',
                debug_show=self.DEBUG,
                placeholders=job_update_placeholders,
                executemany=True)

        # set the job_coalesced_to_guid column for any coalesced
        # job found
        if coalesced_job_guid_placeholders:
            self.execute(
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
                job = datum['job']

                job_guid = str(job['job_guid'])
                states[str(job['state'])].append(job_guid)

                # index this place in the ``data`` object
                data_idx.append(job_guid)

            except Exception:
                data_idx.append("skipped")
                # it will get caught later in ``store_job_data``
                # adding the guid as "skipped" will mean it won't be found
                # in the returned list of dup guids from the db.
                # This will cause the bad job to be re-added
                # to ``new_data`` so that the error can be handled
                # in ``store_job_data``.

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
            existing_guids = self.execute(
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
             group_name, group_symbol, job_type, job_symbol,
             option_collection_hash]
        )

        job_tier = job.get('tier') or 1
        # job tier signatures override the setting from the job structure
        tier = 2 if signature in tier_2_signatures else job_tier

        job_placeholders.append([
            job_guid,
            signature,
            None,                   # idx:2, job_coalesced_to_guid,
            revision_hash,          # idx:3, replace with result_set_id
            build_platform_key,     # idx:4, replace with build_platform_id
            machine_platform_key,   # idx:5, replace with machine_platform_id
            machine,                # idx:6, replace with machine_id
            option_collection_hash,  # idx:7
            job_type_key,           # idx:8, replace with job_type_id
            product,                # idx:9, replace with product_id
            who,
            reason,
            job.get('result', 'unknown'),  # idx:12, this is typically an int
            state,
            self.get_number(job.get('submit_timestamp')),
            self.get_number(job.get('start_timestamp')),
            self.get_number(job.get('end_timestamp')),
            0,                      # idx:17, replace with running_avg_sec
            tier,
            job_guid,
            get_guid_root(job_guid)  # will be the same except for ``retry`` jobs
        ])

        artifacts = job.get('artifacts', [])

        has_text_log_summary = False
        if artifacts:
            artifacts = ArtifactsModel.serialize_artifact_json_blobs(artifacts)
            # the artifacts in this list could be ones that should have
            # bug suggestions generated for them.  If so, queue them to be
            # scheduled for asynchronous generation.
            tls_list = error_summary.get_artifacts_that_need_bug_suggestions(
                artifacts)
            async_artifact_list.extend(tls_list)

            # need to add job guid to artifacts, since they likely weren't
            # present in the beginning
            for artifact in artifacts:
                if not all(k in artifact for k in ("name", "type", "blob")):
                    raise JobDataError(
                        "Artifact missing properties: {}".format(artifact))
                artifact_placeholder = artifact.copy()
                artifact_placeholder['job_guid'] = job_guid
                artifact_placeholders.append(artifact_placeholder)

            has_text_log_summary = any(x for x in artifacts
                                       if x['name'] == 'text_log_summary')

        log_refs = job.get('log_references', [])
        if log_refs:
            for log in log_refs:
                name = log.get('name') or 'unknown'
                name = name[0:50]

                url = log.get('url') or 'unknown'
                url = url[0:255]

                # this indicates that a summary artifact was submitted with
                # this job that corresponds to the buildbot_text log url.
                # Therefore, the log does not need parsing.  So we should
                # ensure that it's marked as already parsed.
                if has_text_log_summary and name == 'buildbot_text':
                    parse_status = 'parsed'
                else:
                    # the parsing status of this log.  'pending' or 'parsed'
                    parse_status = log.get('parse_status', 'pending')

                log_placeholders.append([job_guid, name, url, parse_status])

        return job_guid

    def get_number(self, s):
        try:
            return long(s)
        except (ValueError, TypeError):
            return 0

    def _set_data_ids(
        self, index, job_placeholders, id_lookups,
        job_guid_list, job_update_placeholders,
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

        reference_data_signature = job_placeholders[index][1]
        running_avg_sec = job_eta_times.get(reference_data_signature, {}).get('running', 0)

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

    def _load_jobs(self, job_placeholders, job_guid_list):

        if not job_placeholders:
            return {}

        # Store job data
        self.execute(
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

        job_eta_data = self.execute(
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

        job_id_lookup = self.execute(
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

        if log_placeholders:
            for index, log_ref in enumerate(log_placeholders):
                job_guid = log_ref[0]
                job_id = job_id_lookup[job_guid]['id']
                result = job_results[job_guid]
                result_set_id = job_id_lookup[job_guid]['result_set_id']
                result_sets.append(result_set_id)

                # Replace job_guid with id
                log_placeholders[index][0] = job_id
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
                    tasks.append(task)

            # Store the log references
            self.execute(
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
                    routing_key=task['routing_key']
                )

    def get_job_log_url_detail(self, job_log_url_id):
        obj = self.execute(
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

        data = self.execute(
            proc="jobs.selects.get_job_log_url_list",
            placeholders=job_ids,
            replace=replacement,
            debug_show=self.DEBUG,
        )
        return data

    def update_job_log_url_status(self, job_log_url_id, parse_status):

        self.execute(
            proc='jobs.updates.update_job_log_url',
            debug_show=self.DEBUG,
            placeholders=[parse_status, job_log_url_id])

    def _get_last_insert_id(self):
        """Return last-inserted ID."""
        return self.get_dhub().execute(
            proc='generic.selects.get_last_insert_id',
            debug_show=self.DEBUG,
            return_type='iter',
        ).get_column_data('id')

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
            top_revision = result['revisions'][-1]['revision']
            short_top_revision = top_revision[:12]
            revision_hash_placeholders.append(
                [
                    result.get('author', 'unknown@somewhere.com'),
                    result['revision_hash'],
                    top_revision,
                    short_top_revision,
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

                # We may not have a comment in the push data
                comment = rev_datum.get(
                    'comment', None
                )

                repository_id = repository_id_lookup[rev_datum['repository']]
                short_revision = rev_datum['revision'][:12]
                revision_placeholders.append(
                    [rev_datum['revision'],
                     short_revision,
                     short_revision,
                     rev_datum['author'],
                     comment,
                     repository_id,
                     short_revision,
                     repository_id]
                )

                all_revisions.append(short_revision)
                rev_where_in_list.append('%s')
                revision_to_rhash_lookup[short_revision] = result['revision_hash']

        # Retrieve a list of revision_hashes that have already been stored
        # in the list of unique_revision_hashes. Use it to determine the new
        # result_sets found to publish to pulse.
        where_in_clause = ','.join(where_in_list)
        result_set_ids_before = self.execute(
            proc='jobs.selects.get_result_set_ids',
            placeholders=unique_revision_hashes,
            replace=[where_in_clause],
            key_column='revision_hash',
            return_type='set',
            debug_show=self.DEBUG
        )

        # Insert new result sets
        self.execute(
            proc='jobs.inserts.set_result_set',
            placeholders=revision_hash_placeholders,
            executemany=True,
            debug_show=self.DEBUG
        )

        lastrowid = self.get_dhub().connection['master_host']['cursor'].lastrowid

        # Retrieve new and already existing result set ids
        result_set_id_lookup = self.execute(
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
        self.execute(
            proc='jobs.inserts.set_revision',
            placeholders=revision_placeholders,
            executemany=True,
            debug_show=self.DEBUG
        )

        # Retrieve new revision ids
        rev_where_in_clause = ','.join(rev_where_in_list)
        revision_id_lookup = self.execute(
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
        self.execute(
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
        replace = [self.refdata_model.get_db_name()]
        placeholders = [resultset_id]
        if exclusion_profile:
            signature_list = self.get_exclusion_profile_signatures(exclusion_profile)
            if signature_list:
                signatures_replacement = ",".join(["%s"] * len(signature_list))
                replace.append(
                    "AND signature NOT IN ({0})".format(signatures_replacement)
                )
                placeholders += signature_list

        resulset_status_list = self.execute(
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

    def get_job_repeats(self, ref_job_guid):
        job_list = self.execute(
            proc='jobs.selects.get_job_retriggers',
            placeholders=[ref_job_guid],
            debug_show=self.DEBUG)
        return job_list


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
