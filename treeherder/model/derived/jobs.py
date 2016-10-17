import logging
import time
from datetime import datetime
from hashlib import sha1

import newrelic.agent
from django.conf import settings

from treeherder.etl.common import get_guid_root
from treeherder.model import utils
from treeherder.model.models import (BuildPlatform,
                                     Commit,
                                     Datasource,
                                     ExclusionProfile,
                                     FailureLine,
                                     Job,
                                     JobDuration,
                                     JobGroup,
                                     JobLog,
                                     JobNote,
                                     JobType,
                                     Machine,
                                     MachinePlatform,
                                     Option,
                                     OptionCollection,
                                     Product,
                                     Push,
                                     ReferenceDataSignatures,
                                     Repository)
from treeherder.model.search import bulk_delete as es_delete
from treeherder.model.search import TestFailureLine
from treeherder.model.tasks import (publish_job_action,
                                    publish_resultset_action)
from treeherder.model.utils import orm_delete

from .artifacts import ArtifactsModel
from .base import TreeherderModelBase

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
            "platform": "mp.platform",
            "build_platform_id": "j.build_platform_id",
            "build_platform": "bp.platform",
            "build_os": "bp.os_name",
            "build_architecture": "bp.architecture",
            "build_system_type": "rds.build_system_type",
            "machine_platform_id": "j.machine_platform_id",
            "machine_platform_os": "mp.os_name",
            "machine_platform_architecture": "mp.architecture",
            "machine_id": "j.machine_id",
            "machine_name": "m.name",
            "option_collection_hash": "j.option_collection_hash",
            "job_type_id": "j.job_type_id",
            "job_type_symbol": "jt.symbol",
            "job_type_name": "jt.name",
            "job_group_id": "jg.id",
            "job_group_symbol": "jg.symbol",
            "job_group_name": "jg.name",
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
            "ref_data_name": "rds.name",
            "tier": "j.tier"
        },
        "result_set": {
            "id": "rs.id",
            "revision_hash": "rs.revision_hash",
            "revisions_long_revision": "revision.long_revision",
            "revisions_short_revision": "revision.short_revision",
            "short_revision": "rs.short_revision",
            "long_revision": "rs.long_revision",
            "author": "rs.author",
            "push_timestamp": "rs.push_timestamp",
            "last_modified": "rs.last_modified"
        }
    }

    # jobs cycle targets
    # NOTE: There is an order dependency here, cycle_job and
    # cycle_result_set should be after any tables with foreign keys
    # to their ids.
    JOBS_CYCLE_TARGETS = [
        "jobs.deletes.cycle_job_artifact",
        "jobs.deletes.cycle_job",
    ]

    LOWER_TIERS = [2, 3]

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
        repl = [settings.DATABASES['default']['NAME']]
        data = self.execute(
            proc="jobs.selects.get_job",
            placeholders=[id],
            debug_show=self.DEBUG,
            replace=repl,
        )
        return data

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
                signatures = ExclusionProfile.objects.get_signatures_for_project(
                    self.project, exclusion_profile)
                if signatures:
                    # NOT here means "not part of the exclusion profile"
                    inclusion = "NOT" if visibility == "included" else ""
                    replace_str += " AND j.signature {0} IN ({1})".format(
                        inclusion,
                        ",".join(["%s"] * len(signatures))
                    )
                    placeholders += signatures
                else:
                    # this repo/project has no hidden signatures
                    # if ``visibility`` is set to ``included`` then it's
                    # meaningless to add any of these limiting params to the
                    # query, just run it and give the user everything for the
                    # project.
                    #
                    # If ``visibility`` is ``excluded`` then we only want to
                    # include jobs that were excluded by this profile.  Since
                    # no jobs are excluded for this project, we should return
                    # an empty array and skip the query altogether.
                    if visibility == "excluded":
                        return []
            except ExclusionProfile.DoesNotExist:
                # Either there's no default profile setup or the profile
                # specified is not available
                pass

        repl = [settings.DATABASES['default']['NAME'], replace_str]
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
        repl = [settings.DATABASES['default']['NAME'], replace_str]
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

    def get_incomplete_job_ids(self, resultset_id):
        """Get list of ids for jobs of resultset that are not in complete state."""
        return self.execute(
            proc='jobs.selects.get_incomplete_job_ids',
            placeholders=[resultset_id],
            debug_show=self.DEBUG,
            return_type='tuple'
        )

    def cancel_all_resultset_jobs(self, requester, resultset_id):
        """Set all pending/running jobs in resultset to usercancel."""
        jobs = self.get_incomplete_job_ids(resultset_id)

        # Mark pending jobs as cancelled to work around buildbot not including
        # cancelled jobs in builds-4hr if they never started running.
        # TODO: Remove when we stop using buildbot.
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

        # Mark pending jobs as cancelled to work around buildbot not including
        # cancelled jobs in builds-4hr if they never started running.
        # TODO: Remove when we stop using buildbot.
        self.execute(
            proc='jobs.updates.cancel_job',
            placeholders=[job['job_guid']],
            debug_show=self.DEBUG
        )

    def get_max_job_id(self):
        """Get the maximum job id."""
        data = self.get_dhub().execute(
            proc="jobs.selects.get_max_job_id",
            debug_show=self.DEBUG,
        )
        return int(data[0]['max_id'] or 0)

    def update_last_job_classification(self, job_id):
        """
        Update failure_classification_id no the job table accordingly to
        the latest annotation. If none is present it gets reverted to the
        default value
        """
        note = JobNote.objects.filter(
            job__repository__name=self.project,
            job__project_specific_id=job_id).order_by('-created').first()

        if note:
            failure_classification_id = note.failure_classification.id
        else:
            failure_classification_id = 0

        self.execute(
            proc='jobs.updates.update_last_job_classification',
            placeholders=[
                failure_classification_id, job_id
            ],
            debug_show=self.DEBUG
        )

    def calculate_durations(self, sample_window_seconds, debug):
        # Get the most recent timestamp from jobs
        max_start_timestamp = self.execute(
            proc='jobs.selects.get_max_job_start_timestamp',
            return_type='iter',
            debug_show=self.DEBUG
        ).get_column_data('start_timestamp')

        if not max_start_timestamp:
            return

        time_window = int(max_start_timestamp) - sample_window_seconds
        average_durations = self.execute(
            proc='jobs.selects.get_average_job_durations',
            placeholders=[time_window],
            return_type='tuple',
            debug_show=self.DEBUG
        )

        repository = Repository.objects.get(name=self.project)
        for job in average_durations:
            JobDuration.objects.update_or_create(signature=job['signature'],
                                                 repository=repository,
                                                 defaults={'average_duration': job['average_duration']})

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
            job_guid_list = [d['job_guid'] for d in jobs_chunk]
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

            # Remove ORM entries for these jobs (objects referring to Job, like
            # JobDetail and JobLog, are cycled automatically via ON DELETE
            # CASCADE)
            failure_line_query = FailureLine.objects.filter(job_guid__in=job_guid_list)

            if settings.ELASTIC_SEARCH["url"]:
                # To delete the data from elasticsearch we need both the document id and the
                # test, since this is used to determine the shard on which the document is indexed.
                # However selecting all this data can be rather slow, so split the job into multiple
                # smaller chunks.
                failure_line_max_id = failure_line_query.order_by("-id").values_list("id", flat=True).first()
                while failure_line_max_id:
                    es_delete_data = list(failure_line_query
                                          .order_by("-id")
                                          .filter(id__lte=failure_line_max_id)
                                          .values_list("id", "test")[:chunk_size])
                    if es_delete_data:
                        es_delete(TestFailureLine, es_delete_data)
                        # Compute the first possible id of a failure line not selected in the
                        # previous query
                        min_id_in_chunk, _ = es_delete_data[-1]
                        failure_line_max_id = min_id_in_chunk - 1
                    else:
                        failure_line_max_id = None
            orm_delete(FailureLine, failure_line_query,
                       chunk_size, sleep_time)
            orm_delete(Job, Job.objects.filter(guid__in=job_guid_list),
                       chunk_size, sleep_time)

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

    def _add_short_revision_lookups(self, lookup):
        short_rev_lookup = {}
        for rev, rs in lookup.iteritems():
            short_rev_lookup[rev[:12]] = rs
        lookup.update(short_rev_lookup)

    def _get_short_and_long_revision_query_params(self, revision_list,
                                                  short_revision_field="short_revision",
                                                  long_revision_field="long_revision"):
        """Build params to search for both long and short revisions."""

        long_revision_list = [x for x in revision_list if len(x) == 40]
        short_revision_list = [x[:12] for x in revision_list]
        long_rev_list_repl = ",".join(["%s"] * len(long_revision_list))
        short_rev_list_repl = ",".join(["%s"] * len(short_revision_list))

        # It's possible that only 12 char revisions were passed in, so the
        # ``long_revision_list`` would be zero length.  If it is, then this
        # adds nothing to the where clause.
        long_revision_or = ""
        if long_revision_list:
            long_revision_or = " OR {} IN ({})".format(
                long_revision_field,
                long_rev_list_repl
            )

        replacement = " AND ({} IN ({}) {})".format(
            short_revision_field,
            short_rev_list_repl,
            long_revision_or
        )
        placeholders = short_revision_list + long_revision_list

        return {
            "replacement": [replacement],
            "placeholders": placeholders
        }

    def get_resultset_all_revision_lookup(self, revision_list):
        """
        Create a revision->resultset lookup from a list of revisions

        This will map ALL revision/commits that are within this resultset, not
        just the top revision.  It will also map both short and long revisions
        to their resultsets because users might search by either.

        This will retrieve non-active resultsets as well.  Some of the data
        ingested has mixed up revisions that show for jobs, but are not in
        the right repository in builds4hr/running/pending.  So we ingest those
        bad resultsets/revisions as non-active so that we don't keep trying
        to re-ingest them.  Allowing this query to retrieve non ``active``
        resultsets means we will avoid re-doing that work by detecting that
        we've already ingested it.

        But we skip ingesting the job, because the resultset is not active.
        """

        if not revision_list:
            return {}

        # Build params to search for both long and short revisions.
        params = self._get_short_and_long_revision_query_params(
            revision_list,
            "revision.short_revision",
            "revision.long_revision")

        proc = "jobs.selects.get_resultset_all_revision_lookup"
        lookup = self.execute(
            proc=proc,
            placeholders=params["placeholders"],
            debug_show=self.DEBUG,
            replace=params["replacement"],
            return_type="dict",
            key_column="long_revision"
        )

        # ``lookups`` will be keyed ONLY by long_revision, at this point.
        # Add the resultsets keyed by short_revision.
        self._add_short_revision_lookups(lookup)
        return lookup

    def get_resultset_top_revision_lookup(self, revision_list):
        """
        Create a revision->resultset lookup only for top revisions of the RS

        This lookup does NOT search any revision but the top revision
        for the resultset.  It also does not do a JOIN to the revisions
        table.  So if the resutlset has no revisions mapped to it, that's
        ok.
        """
        if not revision_list:
            return {}

        # Build params to search for both long and short revisions.
        params = self._get_short_and_long_revision_query_params(revision_list)
        lookup = self.execute(
            proc='jobs.selects.get_resultset_top_revision_lookup',
            placeholders=params["placeholders"],
            replace=params["replacement"],
            debug_show=self.DEBUG,
            key_column='long_revision',
            return_type='dict')

        return lookup

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

    def _get_lower_tier_signatures(self):
        # get the lower tier data signatures for this project.
        # if there are none, then just return an empty list
        # this keeps track of them order (2, then 3) so that the latest
        # will have precedence.  If a job signature is in both Tier-2 and
        # Tier-3, then it will end up in Tier-3.
        lower_tier_signatures = []
        for tier_num in self.LOWER_TIERS:
            try:
                signatures = ExclusionProfile.objects.get_signatures_for_project(
                    self.project, "Tier-{}".format(tier_num))
                lower_tier_signatures.append({
                    'tier': tier_num,
                    'signatures': signatures
                })
            except ExclusionProfile.DoesNotExist:
                # no exclusion profile for this tier
                pass

        return lower_tier_signatures

    def store_job_data(self, data):
        """
        Store job data instances into jobs db

        Example:
        [
            {
                "revision": "24fd64b8251fac5cf60b54a915bffa7e51f636b5",
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

        coalesced_job_guid_placeholders = []

        lower_tier_signatures = self._get_lower_tier_signatures()

        for datum in data:
            try:
                # TODO: this might be a good place to check the datum against
                # a JSON schema to ensure all the fields are valid.  Then
                # the exception we caught would be much more informative.  That
                # being said, if/when we transition to only using the pulse
                # job consumer, then the data will always be vetted with a
                # JSON schema before we get to this point.
                job = datum['job']
                coalesced = datum.get('coalesced', [])

                # For a time, we need to backward support jobs submited with either a
                # ``revision_hash`` or a ``revision``.  Eventually, we will
                # migrate to ONLY ``revision``.  But initially, we will need
                # to find the revision from the revision_hash.
                rs_fields = ["revision", "revision_hash"]
                if not any([x for x in rs_fields if x in datum]):
                    raise ValueError("Job must have either ``revision`` or ``revision_hash``")

                revision = datum.get("revision", None)
                if not revision:
                    newrelic.agent.record_exception(
                        exc=ValueError("job submitted with revision_hash but no revision"),
                        params={
                            "revision_hash": datum["revision_hash"]
                        }
                    )
                    revision = self.get_revision_from_revision_hash(datum["revision_hash"])

                # we assume that there is a result set for this revision by this point
                result_set_id_list = self.execute(
                    proc='jobs.selects.get_resultset_id_from_revision',
                    debug_show=self.DEBUG,
                    placeholders=[revision])
                if not result_set_id_list:
                    raise ValueError("Result set not found for revision")
                result_set_id = result_set_id_list[0]['id']
                push_id = Push.objects.values_list('id', flat=True).get(
                    repository__name=self.project,
                    revision__startswith=revision)

                # load job
                (job_guid, reference_data_signature) = self._load_job(
                    job, result_set_id, push_id, lower_tier_signatures)

                for coalesced_guid in coalesced:
                    coalesced_job_guid_placeholders.append(
                        # coalesced to guid, coalesced guid
                        [job_guid, coalesced_guid]
                    )
            except Exception as e:
                # we should raise the exception if DEBUG is true, or if
                # running the unit tests.
                if settings.DEBUG or hasattr(settings, "TREEHERDER_TEST_PROJECT"):
                    logger.exception(e)
                    raise

                # make more fields visible in new relic for the job
                # where we encountered the error
                datum.update(datum.get("job", {}))
                newrelic.agent.record_exception(params=datum)

                # skip any jobs that hit errors in these stages.
                continue

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

    def get_revision_from_revision_hash(self, revision_hash):
        """
        Find a revision based on a revision_hash, if possible

        This function only exists for backward-compatibility.  This is needed
        while we have older resultsets that were storing their revision_hashes
        the old way, rather than just using their revisions.  And for any jobs
        that use the old revision_hashes through the API as the way to
        identify what resultset owns the current job.

        Once jobs are no longer submitted with revision_hashes, then we can
        remove this function.
        """

        proc = "jobs.selects.get_revision_from_revision_hash"
        rh = self.execute(
            placeholders=[revision_hash],
            proc=proc,
            debug_show=self.DEBUG,
        )
        if not len(rh):
            raise ValueError("Revision hash not found: {}".format(
                revision_hash))
        return rh[0]["long_revision"]

    def _load_job(self, job_datum, result_set_id, push_id, lower_tier_signatures):
        """
        Load a job into the treeherder database

        If the job is a ``retry`` the ``job_guid`` will have a special
        suffix on it.  But the matching ``pending``/``running`` job will not.
        So we append the suffixed ``job_guid`` to ``retry_job_guids``
        so that we can update the job_id_lookup later with the non-suffixed
        ``job_guid`` (root ``job_guid``). Then we can find the right
        ``pending``/``running`` job and update it with this ``retry`` job.
        """
        build_platform, _ = BuildPlatform.objects.get_or_create(
            os_name=job_datum.get('build_platform', {}).get('os_name', 'unknown'),
            platform=job_datum.get('build_platform', {}).get('platform', 'unknown'),
            architecture=job_datum.get('build_platform', {}).get('architecture',
                                                                 'unknown'))

        machine_platform, _ = MachinePlatform.objects.get_or_create(
            os_name=job_datum.get('machine_platform', {}).get('os_name', 'unknown'),
            platform=job_datum.get('machine_platform', {}).get('platform', 'unknown'),
            architecture=job_datum.get('machine_platform', {}).get('architecture',
                                                                   'unknown'))

        option_names = job_datum.get('option_collection', [])
        option_collection_hash = OptionCollection.calculate_hash(
            option_names)
        if not OptionCollection.objects.filter(
                option_collection_hash=option_collection_hash).exists():
            # in the unlikely event that we haven't seen this set of options
            # before, add the appropriate database rows
            options = []
            for option_name in option_names:
                option, _ = Option.objects.get_or_create(name=option_name)
                options.append(option)
            for option in options:
                OptionCollection.objects.create(
                    option_collection_hash=option_collection_hash,
                    option=option)

        machine, _ = Machine.objects.get_or_create(
            name=job_datum.get('machine', 'unknown'))

        # if a job with this symbol and name exists, always
        # use its default group (even if that group is different
        # from that specified)
        job_type, _ = JobType.objects.get_or_create(
            symbol=job_datum.get('job_symbol') or 'unknown',
            name=job_datum.get('name') or 'unknown')
        if job_type.job_group:
            job_group = job_type.job_group
        else:
            job_group, _ = JobGroup.objects.get_or_create(
                name=job_datum.get('group_name') or 'unknown',
                symbol=job_datum.get('group_symbol') or 'unknown')
            job_type.job_group = job_group
            job_type.save(update_fields=['job_group'])

        product_name = job_datum.get('product_name', 'unknown')
        if len(product_name.strip()) == 0:
            product_name = 'unknown'
        product, _ = Product.objects.get_or_create(name=product_name)

        job_guid = job_datum['job_guid']
        job_guid = job_guid[0:50]

        who = job_datum.get('who') or 'unknown'
        who = who[0:50]

        reason = job_datum.get('reason') or 'unknown'
        reason = reason[0:125]

        state = job_datum.get('state') or 'unknown'
        state = state[0:25]

        build_system_type = job_datum.get('build_system_type', 'buildbot')

        reference_data_name = job_datum.get('reference_data_name', None)

        sh = sha1()
        sh.update(''.join(
            map(lambda x: str(x),
                [build_system_type, self.project, build_platform.os_name,
                 build_platform.platform, build_platform.architecture,
                 machine_platform.os_name, machine_platform.platform,
                 machine_platform.architecture,
                 job_group.name, job_group.symbol, job_type.name,
                 job_type.symbol, option_collection_hash,
                 reference_data_name])))
        signature_hash = sh.hexdigest()

        # Should be the buildername in the case of buildbot (if not provided
        # default to using the signature hash)
        if not reference_data_name:
            reference_data_name = signature_hash

        signature, created = ReferenceDataSignatures.objects.get_or_create(
            name=reference_data_name,
            signature=signature_hash,
            build_system_type=build_system_type,
            repository=self.project, defaults={
                'first_submission_timestamp': time.time(),
                'build_os_name': build_platform.os_name,
                'build_platform': build_platform.platform,
                'build_architecture': build_platform.architecture,
                'machine_os_name': machine_platform.os_name,
                'machine_platform': machine_platform.platform,
                'machine_architecture': machine_platform.architecture,
                'job_group_name': job_group.name,
                'job_group_symbol': job_group.symbol,
                'job_type_name': job_type.name,
                'job_type_symbol': job_type.symbol,
                'option_collection_hash': option_collection_hash
            })

        if created:
            # A new ReferenceDataSignature has been added, so we need
            # to reload lower tier exclusions
            lower_tier_signatures = self._get_lower_tier_signatures()

        tier = job_datum.get('tier') or 1
        # job tier signatures override the setting from the job structure
        # Check the signatures list for any supported lower tiers that have
        # an active exclusion profile.

        result = job_datum.get('result', 'unknown')

        # As stated elsewhere, a job will end up in the lowest tier where its
        # signature belongs.  So if a signature is in Tier-2 and Tier-3, it
        # will end up in 3.
        for tier_info in lower_tier_signatures:
            if signature_hash in tier_info["signatures"]:
                tier = tier_info["tier"]

        try:
            duration = JobDuration.objects.values_list(
                'average_duration', flat=True).get(
                    repository__name=self.project, signature=signature_hash)
        except JobDuration.DoesNotExist:
            duration = 0

        # try to insert the job unconditionally (if it already exists, this
        # will be a no-op)
        self.execute(
            proc='jobs.inserts.create_job_data',
            debug_show=self.DEBUG,
            placeholders=[
                [
                    job_guid,
                    signature_hash,
                    None,                   # idx:2, job_coalesced_to_guid,
                    result_set_id,
                    push_id,
                    build_platform.id,
                    machine_platform.id,
                    machine.id,
                    option_collection_hash,
                    job_type.id,
                    product.id,
                    who,
                    reason,
                    result,
                    state,
                    self.get_number(job_datum.get('submit_timestamp')),
                    self.get_number(job_datum.get('start_timestamp')),
                    self.get_number(job_datum.get('end_timestamp')),
                    duration,
                    tier,
                    job_guid,
                    get_guid_root(job_guid)  # will be the same except for ``retry`` jobs
                ]
            ],
            executemany=True)

        # by default we should try to update the "root" object
        guid_root = get_guid_root(job_guid)
        ds_job_ids = self.get_job_ids_by_guid([guid_root])
        if ds_job_ids:
            ds_job_id = ds_job_ids[guid_root]['id']
        else:
            ds_job_id = self.get_job_ids_by_guid([job_guid])[job_guid]['id']

        # we might both insert *and* update a job if it comes in with a status
        # that isn't pending, but we're ok with this I think (since this code
        # will be going away soon)
        if state != 'pending':
            self.execute(
                proc="jobs.updates.update_job_data",
                debug_show=self.DEBUG,
                placeholders=[
                    [
                        job_guid,
                        None,
                        result_set_id,
                        push_id,
                        machine.id,
                        option_collection_hash,
                        job_type.id,
                        product.id,
                        who,
                        reason,
                        result,
                        state,
                        self.get_number(job_datum.get('start_timestamp')),
                        self.get_number(job_datum.get('end_timestamp')),
                        state,
                        ds_job_id
                    ]
                ],
                executemany=True)

        # create an intermediate representation of the job useful for doing
        # lookups (this will eventually become the main/only/primary jobs table
        # when we finish migrating away from Datasource, see bug 1178641)
        job, _ = Job.objects.update_or_create(
            repository=Repository.objects.get(name=self.project),
            project_specific_id=ds_job_id,
            defaults={
                'guid': job_guid,
                'push_id': push_id  # FIXME: make this mandatory after migration done
            })

        artifacts = job_datum.get('artifacts', [])

        has_text_log_summary = any(x for x in artifacts
                                   if x['name'] == 'text_log_summary')
        if artifacts:
            artifacts = ArtifactsModel.serialize_artifact_json_blobs(artifacts)

            # need to add job guid to artifacts, since they likely weren't
            # present in the beginning
            for artifact in artifacts:
                if not all(k in artifact for k in ("name", "type", "blob")):
                    raise ValueError(
                        "Artifact missing properties: {}".format(artifact))
                # Ensure every artifact has a ``job_guid`` value.
                # It is legal to submit an artifact that doesn't have a
                # ``job_guid`` value.  But, if missing, it should inherit that
                # value from the job itself.
                if "job_guid" not in artifact:
                    artifact["job_guid"] = job_guid

            with ArtifactsModel(self.project) as artifacts_model:
                artifacts_model.load_job_artifacts(artifacts)

        log_refs = job_datum.get('log_references', [])
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
                    parse_status = JobLog.PARSED
                else:
                    parse_status_map = dict([(k, v) for (v, k) in
                                             JobLog.STATUSES])
                    mapped_status = parse_status_map.get(
                        log.get('parse_status'))
                    if mapped_status:
                        parse_status = mapped_status
                    else:
                        parse_status = JobLog.PENDING

                jl, _ = JobLog.objects.get_or_create(
                    job=job, name=name, url=url, defaults={
                        'status': parse_status
                    })

                self._schedule_log_parsing(jl, result)

        return (job_guid, signature_hash)

    def get_number(self, s):
        try:
            return long(s)
        except (ValueError, TypeError):
            return 0

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

    def _schedule_log_parsing(self, job_log, result):
        """Kick off the initial task that parses the log data.

        log_data is a list of job log objects and the result for that job
        """

        # importing here to avoid an import loop
        from treeherder.log_parser.tasks import parse_job_log

        task_types = {
            "errorsummary_json": ("store_failure_lines", "store_failure_lines"),
            "buildbot_text": ("parse_log", "log_parser"),
            "builds-4h": ("parse_log", "log_parser"),
        }

        # a log can be submitted already parsed.  So only schedule
        # a parsing task if it's ``pending``
        # the submitter is then responsible for submitting the
        # text_log_summary artifact
        if job_log.status != JobLog.PENDING:
            return

        # if this is not a known type of log, abort parse
        if not task_types.get(job_log.name):
            return

        func_name, routing_key = task_types[job_log.name]

        if result != 'success':
            routing_key += '.failures'
        else:
            routing_key += ".normal"

        parse_job_log(func_name, routing_key, job_log)

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

        Determine which ones we already have, which ones we need and
        which ones we need to update.

        result_sets = [
            {
             "revision": "8afdb7debc82a8b6e0d56449dfdf916c77a7bf80",
             "push_timestamp": 1378293517,
             "author": "some-sheriff@mozilla.com",
             "revisions": [
                {
                    "comment": "Bug 911954 - Add forward declaration of JSScript to TraceLogging.h, r=h4writer",
                    "repository": "test_treeherder",
                    "author": "John Doe <jdoe@mozilla.com>",
                    "revision": "8afdb7debc82a8b6e0d56449dfdf916c77a7bf80"
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
            logger.info("No new resultsets to store")
            return {}

        #
        for result_set in result_sets:
            self._load_push(result_set)

        # revision data structures
        revision_placeholders = []
        all_revisions = []
        rev_where_in_list = []

        # revision_map structures
        revision_to_rs_revision_lookup = dict()

        unique_rs_revisions = self._get_unique_revisions(result_sets)

        # Retrieve a list of revisions that have already been stored
        # in the list of unique_revisions. Use it to determine the new
        # result_sets.  Key this off of both long and short revisions since
        # we can get either
        resultsets_before = self.get_resultset_top_revision_lookup(
            unique_rs_revisions)
        self._add_short_revision_lookups(resultsets_before)
        resultset_revisions_before = resultsets_before.keys()

        # UPDATE any resultsets that are incomplete
        #
        resultset_updates = self._get_resultset_updates(
            result_sets, resultsets_before)
        logger.info("Resultsets to update: {}".format(len(resultset_updates)))
        self._modify_resultsets(resultset_updates,
                                "jobs.updates.update_result_set",
                                revision_placeholders,
                                all_revisions, rev_where_in_list,
                                revision_to_rs_revision_lookup)

        # INSERT any resultsets we don't already have
        #
        resultset_inserts = self._get_resultset_inserts(
            result_sets, resultset_revisions_before, unique_rs_revisions)

        logger.info("Resultsets to insert: {}".format(len(resultset_inserts)))
        self._modify_resultsets(resultset_inserts,
                                "jobs.inserts.set_result_set",
                                revision_placeholders,
                                all_revisions, rev_where_in_list,
                                revision_to_rs_revision_lookup)

        last_row_id = self.get_dhub().connection['master_host']['cursor'].lastrowid

        # Retrieve new, updated and already existing result sets that
        # match all the revisions sent in during this request
        result_set_id_lookup = self.get_resultset_top_revision_lookup(
            unique_rs_revisions)
        self._add_short_revision_lookups(result_set_id_lookup)

        # identify the newly inserted result sets
        result_set_ids_after = set(result_set_id_lookup.keys())
        inserted_result_sets = result_set_ids_after.difference(
            resultset_revisions_before
        )

        inserted_result_set_ids = []

        # If cursor.lastrowid is > 0 rows were inserted on this
        # cursor. When new rows are inserted, determine the new
        # result_set ids and submit publish to pulse tasks.
        if inserted_result_sets and last_row_id > 0:

            for revision in inserted_result_sets:
                inserted_result_set_ids.append(
                    result_set_id_lookup[revision]['id']
                )

        # Revisions don't get updated, if we have conflicts here, they
        # are just skipped.  This will insert revisions for both new
        # resultsets and resultset skeletons that were just updated.
        # Resultset skeletons don't get revisions till we insert them here.
        revision_id_lookup = self._insert_revisions(
            revision_placeholders, all_revisions, rev_where_in_list,
            revision_to_rs_revision_lookup, result_set_id_lookup)

        return {
            'result_set_ids': result_set_id_lookup,
            'revision_ids': revision_id_lookup,
            'inserted_result_set_ids': inserted_result_set_ids
        }

    def _get_resultset_updates(self, result_sets,
                               resultsets_before):
        # find the existing resultsets that meet the requirements of needing
        # to be updated.
        rs_need_update = set()
        for rev, resultset in resultsets_before.items():
            if resultset["push_timestamp"] == 0 or \
               len(resultset["long_revision"]) < 40:
                rs_need_update.add(rev)

        # collect the new values for the resultsets that needed updating
        # The revision ingested earlier that needs update could be either
        # 40 or 12 character.  And the new one coming in could be either as
        # well.  The rs_need_update will be keyed by both, but we must
        # check for both 12 and 40.
        resultset_updates = [x for x in result_sets
                             if x["revision"] in rs_need_update or
                             x["revision"][:12] in rs_need_update]
        return resultset_updates

    def _get_resultset_inserts(self, result_sets,
                               resultset_revisions_before,
                               unique_rs_revisions):
        # find the revisions that we don't have resultsets for yet
        revisions_need_insert = unique_rs_revisions.difference(
            resultset_revisions_before)

        # collect the new resultset values that need inserting
        resultset_inserts = [r for r in result_sets
                             if r["revision"] in revisions_need_insert]
        return resultset_inserts

    def _get_unique_revisions(self, result_sets):
        unique_rs_revisions = set()
        for result_set in result_sets:
            if "revision" in result_set:
                unique_rs_revisions.add(result_set["revision"])
                unique_rs_revisions.add(result_set["revision"][:12])
            else:
                top_revision = result_set['revisions'][-1]['revision']
                result_set["revision"] = top_revision
                unique_rs_revisions.add(top_revision)
                unique_rs_revisions.add(top_revision[:12])
                newrelic.agent.record_exception(
                    exc=ValueError(
                        "New resultset submitted without ``revision`` value"),
                    params={"revision": top_revision}
                )
        return unique_rs_revisions

    def _modify_resultsets(self, result_sets, procedure, revision_placeholders,
                           all_revisions, rev_where_in_list,
                           revision_to_rs_revision_lookup):
        """
        Either insert or update resultsets, based on the ``procedure``.
        """
        # result_set data structures
        result_set_placeholders = []
        unique_rs_revisions = set()
        where_in_list = []
        repository_id_lookup = dict()

        for result in result_sets:
            top_revision = result["revision"]
            logger.info("Resultset {} with procedure: {}".format(
                top_revision,
                procedure))
            revision_hash = result.get("revision_hash", top_revision)
            short_top_revision = top_revision[:12]
            result_set_placeholders.append(
                [
                    result.get('author', 'unknown@somewhere.com'),
                    revision_hash,
                    top_revision,
                    short_top_revision,
                    result['push_timestamp'],
                    result.get('active_status', 'active'),
                    top_revision,
                    short_top_revision,
                    revision_hash
                ]
            )
            where_in_list.append('%s')
            unique_rs_revisions.add(top_revision)

            for rev_datum in result['revisions']:

                # Retrieve the associated repository id just once
                # and provide handling for multiple repositories
                if rev_datum['repository'] not in repository_id_lookup:
                    repository_id = Repository.objects.values_list('id').get(
                        name=rev_datum['repository'])[0]
                    repository_id_lookup[rev_datum['repository']] = repository_id

                # We may not have a comment in the push data
                comment = rev_datum.get(
                    'comment', None
                )

                repository_id = repository_id_lookup[rev_datum['repository']]
                long_revision = rev_datum['revision']
                short_revision = long_revision[:12]
                revision_placeholders.append(
                    [long_revision,
                     short_revision,
                     long_revision,
                     rev_datum['author'],
                     comment,
                     repository_id,
                     long_revision,
                     repository_id]
                )

                all_revisions.append(long_revision)
                rev_where_in_list.append('%s')
                revision_to_rs_revision_lookup[long_revision] = top_revision

        self.execute(
            proc=procedure,
            placeholders=result_set_placeholders,
            executemany=True,
            debug_show=self.DEBUG
        )

    def _insert_revisions(self, revision_placeholders,
                          all_revisions, rev_where_in_list,
                          revision_to_rs_revision_lookup,
                          result_set_id_lookup):
        if all_revisions:
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
                key_column='long_revision',
                return_type='dict',
                debug_show=self.DEBUG
            )

            # Build placeholders for revision_map
            revision_map_placeholders = []
            for revision in revision_id_lookup:

                rs_revision = revision_to_rs_revision_lookup[revision]
                revision_id = revision_id_lookup[revision]['id']
                result_set_id = result_set_id_lookup[rs_revision]['id']

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
        else:
            revision_id_lookup = []
        return revision_id_lookup

    def _load_push(self, result_set):
        repository = Repository.objects.get(name=self.project)
        result_set_revision = result_set.get('revision')
        if not result_set.get('revision'):
            raise ValueError("Result set must have a revision "
                             "associated with it!")
        push, _ = Push.objects.update_or_create(
            repository=repository,
            revision=result_set_revision,
            defaults={
                'revision_hash': result_set.get('revision_hash',
                                                result_set_revision),
                'author': result_set['author'],
                'timestamp': datetime.fromtimestamp(
                    result_set['push_timestamp'])
            })
        for revision in result_set['revisions']:
            commit, _ = Commit.objects.update_or_create(
                push=push,
                revision=revision['revision'],
                defaults={
                    'author': revision['author'],
                    'comments': revision['comment']
                })

    def get_resultset_status(self, resultset_id, exclusion_profile="default"):
        """Retrieve an aggregated job count for the given resultset.
        If an exclusion profile is provided, the job counted will be filtered accordingly"""
        replace = [settings.DATABASES['default']['NAME']]
        placeholders = [resultset_id]
        if exclusion_profile:
            try:
                signature_list = ExclusionProfile.objects.get_signatures_for_project(
                    self.project, exclusion_profile)
                if signature_list:
                    signatures_replacement = ",".join(["%s"] * len(signature_list))
                    replace.append(
                        "AND signature NOT IN ({0})".format(signatures_replacement)
                    )
                    placeholders += signature_list
            except ExclusionProfile.DoesNotExist:
                pass

        resultset_status_list = self.execute(
            proc='jobs.selects.get_resultset_status',
            placeholders=placeholders,
            replace=replace,
            debug_show=self.DEBUG)
        num_coalesced = 0
        resultset_status_dict = {}
        for rs in resultset_status_list:
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
