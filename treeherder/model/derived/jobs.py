import json
import MySQLdb
import time

from _mysql_exceptions import IntegrityError

from warnings import filterwarnings, resetwarnings
from django.conf import settings

from treeherder.model.models import Datasource

from treeherder.model import utils

from .base import TreeherderModelBase


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
    CONTENT_TYPES = [CT_JOBS, CT_OBJECTSTORE]
    RESULTS = [
        "busted",
        "exception",
        "testfailed",
        "unknown",
        "usercancel",
        "retry",
        "success",
    ]
    INCOMPLETE_STATES = ["running", "pending"]
    STATES = INCOMPLETE_STATES + ["completed", "coalesced"]

    # list of searchable columns, i.e. those who have an index
    # it would be nice to get this directly from the db and cache it
    INDEXED_COLUMNS = {
        "job": {
            "id": "j.id",
            "job_guid": "j.job_guid",
            "job_coalesced_to_guid": "j.job_coalesced_to_guid",
            "result_set_id": "j.result_set_id",
            "build_platform_id": "j.build_platform_id",
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
            "end_timestamp": "j.end_timestamp"
        },
        "result_set": {
            "id": "rs.id",
            "revision_hash": "rs.revision_hash",
            "revision": "revision.revision",
            "author": "revision.author",
            "push_timestamp": "rs.push_timestamp"
        },
        "bug_job_map": {
            "job_id": "job_id",
            "bug_id": "bug_id",
            "type": "type"
        },
        "job_artifact": {
            "id": "id",
            "job_id": "job_id",
            "name": "name",
            "type": "type"
        }

    }

    OBJECTSTORE_CYCLE_TARGETS = [
        "objectstore.deletes.cycle_objectstore"
    ]

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
        "jobs.deletes.cycle_revision",
        "jobs.deletes.cycle_revision_map",
        "jobs.deletes.cycle_result_set"
    ]

    # 6 months in seconds
    DATA_CYCLE_INTERVAL = 15552000

    @classmethod
    def create(cls, project, host=None):
        """
        Create all the datasource tables for this project.

        """

        if not host:
            host = settings.DATABASES['default']['HOST']

        for ct in [cls.CT_JOBS, cls.CT_OBJECTSTORE]:
            dataset = Datasource.get_latest_dataset(project, ct)
            source = Datasource(
                project=project,
                contenttype=ct,
                dataset=dataset or 1,
                host=host,
            )
            source.save()

        return cls(project=project)

    def get_jobs_dhub(self):
        """Get the dhub for jobs"""
        return self.get_dhub(self.CT_JOBS)

    ##################
    #
    # Job schema data methods
    #
    ##################

    def get_os_dhub(self):
        """Get the dhub for the objectstore"""
        return self.get_dhub(self.CT_OBJECTSTORE)

    def get_job(self, id):
        """Return the job row for this ``job_id``"""
        repl = [self.refdata_model.get_db_name()]
        data = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job",
            placeholders=[id],
            debug_show=self.DEBUG,
            replace=repl,
        )
        return data

    def get_job_list(self, offset, limit, full=True, conditions=None):
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

        repl = [self.refdata_model.get_db_name(), replace_str]

        if full:
            proc = "jobs.selects.get_job_list_full"
        else:
            proc = "jobs.selects.get_job_list"
        data = self.get_jobs_dhub().execute(
            proc=proc,
            replace=repl,
            placeholders=placeholders,
            limit="{0},{1}".format(offset, limit),
            debug_show=self.DEBUG,
        )
        return data

    def _process_conditions(self, conditions, allowed_fields=None):
        """Transform a list of conditions into a list of placeholders and
        replacement strings to feed a datahub.execute statement."""
        placeholders = []
        replace_str = ""
        if conditions:
            for column, condition in conditions.items():
                if allowed_fields is None or column in allowed_fields.keys():
                    if column in allowed_fields.keys():
                        # we need to get the db column string from the passed
                        # in querystring column.  It could be the same, but
                        # often it will have a table prefix for the column.
                        # This allows us to have where clauses on joined fields
                        # of the query.
                        column = allowed_fields[column]
                    for operator, value in condition:
                        replace_str += "AND {0} {1}".format(column, operator)
                        if operator == "IN":
                            # create a list of placeholders of the same length
                            # as the list of values
                            replace_str += "({0})".format(
                                ",".join(["%s"] * len(value))
                            )
                            placeholders += value
                        else:
                            replace_str += " %s "
                            placeholders.append(value)
        return replace_str, placeholders

    def set_state(self, job_id, state):
        """Update the state of an existing job"""
        self.get_jobs_dhub().execute(
            proc='jobs.updates.set_state',
            placeholders=[state, job_id],
            debug_show=self.DEBUG
        )

    def get_log_references(self, job_id):
        """Return the log references for the given ``job_id``."""
        data = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_log_references",
            placeholders=[job_id],
            debug_show=self.DEBUG,
        )
        return data

    def get_job_artifact_references(self, job_id):
        """
        Return the job artifact references for the given ``job_id``.

        This is everything about the artifact, but not the artifact blob
        itself.
        """
        data = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job_artifact_references",
            placeholders=[job_id],
            debug_show=self.DEBUG,
        )
        return data

    def get_job_artifact_list(self, offset, limit, conditions=None):
        """
        Retrieve a list of job artifacts. The conditions parameter is a
        dict containing a set of conditions for each key. e.g.:
        {
            'job_id': set([('IN', (1, 2))])
        }
        """

        replace_str, placeholders = self._process_conditions(
            conditions, self.INDEXED_COLUMNS['job_artifact']
        )

        repl = [replace_str]

        proc = "jobs.selects.get_job_artifact"

        data = self.get_jobs_dhub().execute(
            proc=proc,
            replace=repl,
            placeholders=placeholders,
            limit="{0},{1}".format(offset, limit),
            debug_show=self.DEBUG,
        )
        for artifact in data:
            if artifact["type"] == "json":
                artifact["blob"] = json.loads(artifact["blob"])

        return data

    def get_job_note(self, id):
        """Return the job note by id."""
        data = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job_note",
            placeholders=[id],
            debug_show=self.DEBUG,
        )
        return data

    def get_job_note_list(self, job_id):
        """Return the job notes by job_id."""
        data = self.get_jobs_dhub().execute(
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

        self.get_jobs_dhub().execute(
            proc='jobs.updates.update_last_job_classification',
            placeholders=[
                job_id,
            ],
            debug_show=self.DEBUG
        )

    def insert_job_note(self, job_id, failure_classification_id, who, note):
        """insert a new note for a job and updates its failure classification"""
        self.get_jobs_dhub().execute(
            proc='jobs.inserts.insert_note',
            placeholders=[
                job_id,
                failure_classification_id,
                who,
                note,
                time.time(),
            ],
            debug_show=self.DEBUG
        )
        self.update_last_job_classification(job_id)

    def delete_job_note(self, note_id, job_id):
        """
        Delete a job note and updates the failure classification for that job
        """

        self.get_jobs_dhub().execute(
            proc='jobs.deletes.delete_note',
            placeholders=[
                note_id,
            ],
            debug_show=self.DEBUG
        )

        self.update_last_job_classification(job_id)

    def insert_bug_job_map(self, job_id, bug_id, assignment_type):
        """
        Store a new relation between the given job and bug ids.
        """
        try:
            self.get_jobs_dhub().execute(
                proc='jobs.inserts.insert_bug_job_map',
                placeholders=[
                    job_id,
                    bug_id,
                    assignment_type
                ],
                debug_show=self.DEBUG
            )
        except IntegrityError as e:
            raise JobDataIntegrityError(e)


    def delete_bug_job_map(self, job_id, bug_id):
        """
        Delete a bug-job entry identified by bug_id and job_id
        """
        self.get_jobs_dhub().execute(
            proc='jobs.deletes.delete_bug_job_map',
            placeholders=[
                job_id,
                bug_id
            ],
            debug_show=self.DEBUG
        )

    def cycle_data(self, sql_targets={}, execute_sleep=True):

        min_date = int(time.time() - self.DATA_CYCLE_INTERVAL)

        # Retrieve list of result sets to delete
        result_set_data = self.get_jobs_dhub().execute(
            proc='jobs.selects.get_result_sets_to_cycle',
            placeholders=[min_date],
            debug_show=self.DEBUG
            )

        if len(result_set_data) == 0:
            sql_targets['total_count'] = 0
            return sql_targets

        rs_placeholders = map( lambda x:x['id'], result_set_data )
        rs_where_in_clause = [ ','.join( ['%s'] * len(rs_placeholders) ) ]

        # Retrieve list of revisions associated with result sets
        revision_data = self.get_jobs_dhub().execute(
            proc='jobs.selects.get_revision_ids_to_cycle',
            placeholders=rs_placeholders,
            replace=rs_where_in_clause,
            debug_show=self.DEBUG
            )

        rev_placeholders = map( lambda x:x['revision_id'], revision_data )
        rev_where_in_clause = [ ','.join( ['%s'] * len(rev_placeholders) ) ]

        # Retrieve list of jobs associated with result sets
        job_data = self.get_jobs_dhub().execute(
            proc='jobs.selects.get_jobs_to_cycle',
            placeholders=rs_placeholders,
            replace=rs_where_in_clause,
            debug_show=self.DEBUG
            )

        guid_placeholders = []
        job_id_placeholders = []

        for d in job_data:
            guid_placeholders.append(d['job_guid'])
            job_id_placeholders.append(d['id'])

        jobs_where_in_clause = [ ','.join( ['%s'] * len(job_id_placeholders) ) ]

        # Associate placeholders and replace data with sql
        obj_targets = []
        for sql in self.OBJECTSTORE_CYCLE_TARGETS:
            obj_targets.append(
                { "sql":sql,
                  "placeholders":guid_placeholders,
                  "replace":jobs_where_in_clause } )

        jobs_targets = []
        for sql in self.JOBS_CYCLE_TARGETS:

            if sql == 'cycle_revision':

                jobs_targets.append(
                    { "sql":sql,
                      "placeholders":rev_placeholders,
                      "replace":rev_where_in_clause } )

            elif sql == 'cycle_revision_map':

                jobs_targets.append(
                    { "sql":sql,
                      "placeholders":rs_placeholders,
                      "replace":rs_where_in_clause } )

            elif sql == 'cycle_result_set':

                jobs_targets.append(
                    { "sql":sql,
                      "placeholders":rs_placeholders,
                      "replace":rs_where_in_clause } )

            else:

                jobs_targets.append(
                    { "sql":sql,
                      "placeholders":job_id_placeholders,
                      "replace":jobs_where_in_clause } )

        sql_targets['total_count'] = 0

        # remove data from specified objectstore and jobs tables that is
        # older than 6 months
        self._execute_table_deletes(
            min_date, self.get_os_dhub(), obj_targets, sql_targets,
            execute_sleep
            )

        self._execute_table_deletes(
            min_date, self.get_jobs_dhub(), jobs_targets, sql_targets,
            execute_sleep
            )

        return sql_targets

    def _execute_table_deletes(
        self, min_date, dhub, sql_to_execute, sql_targets, execute_sleep):

        for sql_obj in sql_to_execute:

            sql = sql_obj['sql']
            placeholders = sql_obj['placeholders']
            replace = sql_obj['replace']

            if sql not in sql_targets:
                # First pass for sql
                sql_targets[sql] = None

            if (sql_targets[sql] == None) or (sql_targets[sql] > 0):

                # Disable foreign key checks to improve performance
                dhub.execute(
                    proc='generic.db_control.disable_foreign_key_checks',
                    debug_show=self.DEBUG
                    )

                dhub.execute(
                    proc=sql,
                    placeholders=placeholders,
                    replace=replace,
                    debug_show=self.DEBUG,
                    )

                row_count = dhub.connection['master_host']['cursor'].rowcount

                dhub.commit('master_host')

                # Re-enable foreign key checks to improve performance
                dhub.execute(
                    proc='generic.db_control.enable_foreign_key_checks',
                    debug_show=self.DEBUG
                    )

                sql_targets[sql] = row_count
                sql_targets['total_count'] += row_count

                if execute_sleep:
                    # Allow some time for other queries to get through
                    time.sleep(5)

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

        proc = "jobs.selects.get_bug_job_map"

        data = self.get_jobs_dhub().execute(
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
              revision_hash1:id1,
              revision_hash2:id2,
              ...
                }
            """
        where_in_clause = ','.join(where_in_list)

        result_set_id_lookup = {}

        if revision_hashes:
            result_set_id_lookup = self.get_jobs_dhub().execute(
                proc='jobs.selects.get_result_set_ids',
                placeholders=revision_hashes,
                replace=[where_in_list],
                debug_show=self.DEBUG,
                key_column='revision_hash',
                return_type='dict')

        return result_set_id_lookup

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
        result_set_ids = self.get_jobs_dhub().execute(
            proc=proc,
            replace=[replace_str],
            placeholders=placeholders,
            limit=limit,
            debug_show=self.DEBUG,
        )

        aggregate_details = self.get_result_set_details(result_set_ids)

        # Construct the return dataset, include all revisions associated
        # with each result_set in the revision_list attribute
        return_list = []
        for result in result_set_ids:

            detail = aggregate_details[result['id']][0]
            list_item = {
                "id": result['id'],
                "revision_hash": result['revision_hash'],
                "push_timestamp": result['push_timestamp'],
                "repository_id": detail['repository_id'],
                "revision": detail['revision'],
                "author": result['author'],
                "revision_count": len(aggregate_details[result['id']])
            }
            if full:
                list_item.update({
                    "comments": detail['comments'],
                    "revision_list": aggregate_details[result['id']]
                })
            return_list.append(list_item)

        return return_list

    def get_revision_resultset_lookup(self, revision_list):
        """
        Create a list of revision->resultset lookups from a list of revision
        """

        replacement = ",".join(["%s"] * len(revision_list))
        replacement = " AND revision IN ("+replacement+") "

        proc = "jobs.selects.get_revision_resultset_lookup"
        lookups = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=revision_list+[0, len(revision_list)],
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
        lookups = self.get_jobs_dhub().execute(
            proc=proc,
            debug_show=self.DEBUG,
            replace=[result_set_id],
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
        result_set_details = self.get_jobs_dhub().execute(
            proc=detail_proc,
            placeholders=ids,
            debug_show=self.DEBUG,
            replace=[where_in_clause],
        )

        # Aggregate the revisions by result_set_id
        aggregate_details = {}
        for detail in result_set_details:

            if detail['result_set_id'] not in aggregate_details:
                aggregate_details[ detail['result_set_id'] ] = []

            aggregate_details[ detail['result_set_id'] ].append(
                {
                    'revision':detail['revision'],
                    'author':detail['author'],
                    'repository_id':detail['repository_id'],
                    'comments':detail['comments'],
                    'commit_timestamp':detail['commit_timestamp']
                })

        return aggregate_details

    def get_result_set_job_list(self, result_set_ids, full=True, **kwargs):
        """
        Retrieve a list of ``jobs`` and results for a result_set.

        Mainly used by the restful api to list the job results in the UI
        """
        if not result_set_ids:
            # No result sets provided
            return {}

        repl = [self.refdata_model.get_db_name()]

        # Generate a list of result_set_ids
        id_placeholders = []
        for data in result_set_ids:
            id_placeholders.append('%s')
        repl.append(','.join(id_placeholders))

        # filter by job_type if specified
        if "job_type_name" in kwargs:
            repl.append(" AND jt.`name` = '{0}'".format(kwargs["job_type_name"]))

        if full:
            proc = "jobs.selects.get_result_set_job_list_full"
        else:
            proc = "jobs.selects.get_result_set_job_list"
        data = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=result_set_ids,
            debug_show=self.DEBUG,
            replace=repl,
        )

        return data

    def get_push_timestamp_lookup(self, result_set_ids):
        """Get the push timestamp for a list of result_set."""

        # Generate a list of result_set_ids
        id_placeholders = []
        repl = []
        for data in result_set_ids:
            id_placeholders.append('%s')
        repl.append(','.join(id_placeholders))

        proc = "jobs.selects.get_result_set_push_timestamp"
        data = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=result_set_ids,
            debug_show=self.DEBUG,
            replace=repl,
            return_type="dict",
            key_column="id"
        )
        return data

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
            self.get_os_dhub().execute(
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
        json_blobs = self.get_os_dhub().execute(
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
                        artifact:{
                            type:" json | img | ...",
                            name:"",
                            log_urls:[
                                ]
                            blob:""
                        },
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
        # Insure that we have job data to process
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

        # Structures supporting update of job data in SQL
        update_placeholders = []

        # List of json object ids and associated revision_hashes
        # loaded. Used to mark the status complete.
        object_placeholders = []

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

            except Exception as e:
                if 'id' in datum:
                    self.mark_object_error(
                        datum['id'],
                        u"Unknown error: {0}: {1}".format(
                            e.__class__.__name__, unicode(e))
                    )
                if raise_errors:
                    raise e
            else:

                # json object can be sucessfully deserialized
                # load reference data
                job_guid = self._load_ref_and_job_data_structs(
                    job,
                    revision_hash,
                    revision_hash_lookup,
                    unique_revision_hashes,
                    rh_where_in,
                    job_placeholders,
                    log_placeholders,
                    artifact_placeholders
                    )

                if 'id' in datum:
                    object_placeholders.append(
                        [ revision_hash, datum['id'] ]
                        )

                for coalesced_guid in coalesced:
                    coalesced_job_guid_placeholders.append(
                        # coalesced to guid, coalesced guid
                        [ job_guid, coalesced_guid ]
                        )

        # Store all reference data and retrieve associated ids
        id_lookups = self.refdata_model.set_all_reference_data()

        # Store all revision hashes and retrieve result_set_ids
        result_set_ids = self.get_result_set_ids(
            unique_revision_hashes, rh_where_in
            )

        job_update_placeholders = []
        job_guid_list = []
        job_guid_where_in_list = []

        for index, job in enumerate(job_placeholders):

            # Replace reference data with their associated ids
            self._set_data_ids(
                index,
                job_placeholders,
                id_lookups,
                job_guid_list,
                job_guid_where_in_list,
                job_update_placeholders,
                result_set_ids
                )

        job_id_lookup = self._load_jobs(
            job_placeholders, job_guid_where_in_list, job_guid_list
            )

        # Need to iterate over log references separately since they could
        # be a different length. Replace job_guid with id in log url
        # placeholders
        # need also to retrieve the updated status to distinguish between
        # failed and successful jobs
        job_results = dict((el[-1], el[8]) for el in job_update_placeholders)

        self._load_log_urls(log_placeholders, job_id_lookup,
                            job_results)

        self._load_job_artifacts(artifact_placeholders, job_id_lookup)

        # If there is already a job_id stored with pending/running status
        # we need to update the information for the complete job
        if job_update_placeholders:
            # replace job_guid with job_id
            for row in job_update_placeholders:
                row[-1] = job_id_lookup[row[-1]]['id']

            self.get_jobs_dhub().execute(
                proc='jobs.updates.update_job_data',
                debug_show=self.DEBUG,
                placeholders=job_update_placeholders,
                executemany=True )

        # Mark job status
        self.mark_objects_complete(object_placeholders)

        # set the job_coalesced_to_guid column for any coalesced
        # job found
        if coalesced_job_guid_placeholders:
            self.get_jobs_dhub().execute(
                proc='jobs.updates.update_coalesced_guids',
                debug_show=self.DEBUG,
                placeholders=coalesced_job_guid_placeholders,
                executemany=True )

    def _load_ref_and_job_data_structs(
        self, job, revision_hash, revision_hash_lookup,
        unique_revision_hashes, rh_where_in, job_placeholders,
        log_placeholders, artifact_placeholders
        ):

        # Store revision_hash to support SQL construction
        # for result_set entry
        if revision_hash not in revision_hash_lookup:
            unique_revision_hashes.append(revision_hash)
            rh_where_in.append('%s')

        build_platform_key = self.refdata_model.add_build_platform(
            job.get('build_platform', {}).get('os_name', 'unknown'),
            job.get('build_platform', {}).get('platform', 'unknown'),
            job.get('build_platform', {}).get('architecture', 'unknown')
            )

        machine_platform_key = self.refdata_model.add_machine_platform(
            job.get('machine_platform', {}).get('os_name', 'unknown'),
            job.get('machine_platform', {}).get('platform', 'unknown'),
            job.get('machine_platform', {}).get('architecture', 'unknown')
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
        self.refdata_model.add_product(product)

        job_guid = job['job_guid']
        job_guid = job_guid[0:50]

        who = job.get('who', 'unknown')
        who = who[0:50]

        reason = job.get('reason', 'unknown')
        reason = reason[0:125]

        state = job.get('state', 'unknown')
        state = state[0:25]

        job_placeholders.append([
            job_guid,
            None,                   # idx:1, job_coalesced_to_guid,
                                    # TODO: How do find this value?
            revision_hash,          # idx:2, replace with result_set_id
            build_platform_key,     # idx:3, replace with build_platform_id
            machine_platform_key,   # idx:4, replace with machine_platform_id
            machine,                # idx:5, replace with machine_id
            option_collection_hash, # idx:6
            job_type_key,           # idx:7, replace with job_type_id
            product,                # idx:8, replace with product_id
            who,
            reason,
            job.get('result', 'unknown'), # idx:11, this is typically an int
            state,
            self.get_number( job.get('submit_timestamp') ),
            self.get_number( job.get('start_timestamp') ),
            self.get_number( job.get('end_timestamp') ),
            job_guid
            ])

        log_refs = job.get('log_references', [])
        if log_refs:
            for log in log_refs:

                name = log.get('name', 'unknown')
                name = name[0:50]

                url = log.get('url', 'unknown')
                url = url[0:255]

                log_placeholders.append([job_guid, name, url])

        artifact = job.get('artifact', {})
        if artifact:
            name = artifact.get('name')
            artifact_type = artifact.get('type')

            blob = artifact.get('blob')
            if (artifact_type == 'json') and (not isinstance(blob, str)):
                blob = json.dumps(blob)

            if name and artifact_type and blob:
                artifact_placeholders.append(
                    [job_guid, name, artifact_type, blob]
                    )

        return job_guid

    def get_number(self, s):
        try:
            return long(s)
        except (ValueError, TypeError):
            return 0


    def _set_data_ids(
        self, index, job_placeholders, id_lookups,
        job_guid_list, job_guid_where_in_list, job_update_placeholders,
        result_set_ids
        ):

        # Replace reference data with their ids
        job_guid = job_placeholders[index][0]
        job_coalesced_to_guid = job_placeholders[index][1]
        revision_hash = job_placeholders[index][2]
        build_platform_key = job_placeholders[index][3]
        machine_platform_key = job_placeholders[index][4]
        machine_name = job_placeholders[index][5]
        option_collection_hash = job_placeholders[index][6]
        job_type_key = job_placeholders[index][7]
        product_type = job_placeholders[index][8]
        who = job_placeholders[index][9]
        reason = job_placeholders[index][10]
        result = job_placeholders[index][11]
        job_state = job_placeholders[index][12]
        submit_timestamp = job_placeholders[index][13]
        start_timestamp = job_placeholders[index][14]
        end_timestamp = job_placeholders[index][15]

        # Load job_placeholders

        # replace revision_hash with id
        job_placeholders[index][2] = result_set_ids[revision_hash]['id']

        # replace build_platform_key with id
        job_placeholders[index][3] = id_lookups['build_platforms'][build_platform_key]['id']

        # replace machine_platform_key with id
        job_placeholders[index][4] = id_lookups['machine_platforms'][machine_platform_key]['id']

        # replace machine with id
        job_placeholders[index][5] = id_lookups['machines'][machine_name]['id']

        # replace job_type with id
        job_placeholders[index][7] = id_lookups['job_types'][job_type_key]['id']

        # replace product_type with id
        job_placeholders[index][8] = id_lookups['products'][product_type]['id']

        job_guid_list.append(job_guid)
        job_guid_where_in_list.append('%s')

        # Load job_update_placeholders
        if job_state != 'pending':

            job_update_placeholders.append([
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
                job_guid
                ] )

    def _load_jobs(
        self, job_placeholders, job_guid_where_in_list, job_guid_list
        ):

        if not job_placeholders:
            return {}

        # Store job data
        self.get_jobs_dhub().execute(
            proc='jobs.inserts.create_job_data',
            debug_show=self.DEBUG,
            placeholders=job_placeholders,
            executemany=True )

        return self.get_job_ids_by_guid(job_guid_list)

    def get_job_ids_by_guid(self, job_guid_list):

        job_guid_where_in_clause = ",".join(["%s"] * len(job_guid_list))

        job_id_lookup = self.get_jobs_dhub().execute(
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
        from treeherder.log_parser.tasks import parse_log

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
                task['job_guid'] = job_guid
                task['log_url'] = log_ref[2]
                task['result_set_id'] = result_set_id
                if result != 'success':
                    task['check_errors'] = True
                    task['routing_key'] = 'parse_log.failures'
                else:
                    task['check_errors'] = False
                    task['routing_key'] = 'parse_log.success'
                tasks.append(task)

            # a dict of result_set_id => push_timestamp
            push_timestamp_lookup = self.get_push_timestamp_lookup(result_sets)

            # Store the log references
            self.get_jobs_dhub().execute(
                proc='jobs.inserts.set_job_log_url',
                debug_show=self.DEBUG,
                placeholders=log_placeholders,
                executemany=True)

            for task in tasks:
                parse_log.apply_async(
                    args=[
                        self.project,
                        task['log_url'],
                        task['job_guid'],
                        push_timestamp_lookup[task['result_set_id']]
                    ],
                    kwargs={'check_errors': task['check_errors']},
                    routing_key=task['routing_key']
                )


    def store_job_artifact(self, artifact_placeholders):
        """
        Store a list of job_artifacts given a list of placeholders
        """
        self.get_jobs_dhub().execute(
            proc='jobs.inserts.set_job_artifact',
            debug_show=self.DEBUG,
            placeholders=artifact_placeholders,
            executemany=True)

    def _load_job_artifacts(self, artifact_placeholders, job_id_lookup):
        """
        Store a list of job artifacts substituting job_guid with job_id
        """
        # Replace job_guid with id in artifact placeholders
        for index, artifact in enumerate(artifact_placeholders):
            artifact_placeholders[index][0] = job_id_lookup[
                artifact_placeholders[index][0]]['id']

        if artifact_placeholders:
            self.store_job_artifact(artifact_placeholders)

    def _get_last_insert_id(self, contenttype="jobs"):
        """Return last-inserted ID."""
        return self.get_dhub(contenttype).execute(
            proc='generic.selects.get_last_insert_id',
            debug_show=self.DEBUG,
            return_type='iter',
        ).get_column_data('id')

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
        self.get_os_dhub().execute(
            proc=proc_mark,
            placeholders=[limit],
            debug_show=self.DEBUG,
        )

        resetwarnings()

        # Return all JSON blobs claimed by this connection ID (could possibly
        # include orphaned rows from a previous run).
        json_blobs = self.get_os_dhub().execute(
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
            self.get_os_dhub().execute(
                proc="objectstore.updates.mark_complete",
                placeholders=object_placeholders,
                executemany=True,
                debug_show=self.DEBUG
            )

    def mark_object_error(self, object_id, error):
        """ Call to database to mark the task completed """
        self.get_os_dhub().execute(
            proc="objectstore.updates.mark_error",
            placeholders=[error, object_id],
            debug_show=self.DEBUG
        )

    def get_json_blob_by_guid(self, guid):
        """retrieves a json_blob given its guid"""
        data = self.get_os_dhub().execute(
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
        json_blobs = self.get_os_dhub().execute(
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
                    repository_id_lookup[ rev_datum['repository'] ] = repository_id

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

                repository_id = repository_id_lookup[ rev_datum['repository'] ]
                revision_placeholders.append(
                    [ rev_datum['revision'],
                      rev_datum['author'],
                      comment,
                      file_str,
                      commit_timestamp,
                      repository_id,
                      rev_datum['revision'],
                      repository_id ]
                    )

                all_revisions.append(rev_datum['revision'])
                rev_where_in_list.append('%s')
                revision_to_rhash_lookup[rev_datum['revision']] = result['revision_hash']

        # Insert new result sets
        self.get_jobs_dhub().execute(
            proc='jobs.inserts.set_result_set',
            placeholders=revision_hash_placeholders,
            executemany=True,
            debug_show=self.DEBUG
            )

        # Retrieve new result set ids
        where_in_clause = ','.join(where_in_list)
        result_set_id_lookup = self.get_jobs_dhub().execute(
            proc='jobs.selects.get_result_set_ids',
            placeholders=unique_revision_hashes,
            replace=[where_in_clause],
            key_column='revision_hash',
            return_type='dict',
            debug_show=self.DEBUG
            )

        # Insert new revisions
        self.get_jobs_dhub().execute(
            proc='jobs.inserts.set_revision',
            placeholders=revision_placeholders,
            executemany=True,
            debug_show=self.DEBUG
            )

        # Retrieve new revision ids
        rev_where_in_clause = ','.join(rev_where_in_list)
        select_proc = 'get_revision_ids'
        revision_id_lookup = self.get_jobs_dhub().execute(
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
                [ revision_id,
                  result_set_id,
                  revision_id,
                  result_set_id ]
                )

        # Insert new revision_map entries
        self.get_jobs_dhub().execute(
            proc='jobs.inserts.set_revision_map',
            placeholders=revision_map_placeholders,
            executemany=True,
            debug_show=self.DEBUG
            )

        return {
            'result_set_ids':result_set_id_lookup,
            'revision_ids':revision_id_lookup
            }

    def get_revision_timestamp(self, rev):
        """Get the push timestamp of the resultset for a revision"""
        return self.get_revision_resultset_lookup([rev])[rev][
            "push_timestamp"
            ]


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
