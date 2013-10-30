import json
import MySQLdb
import time

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
    STATES = ["pending", "running", "completed", "coalesced"]

    # this dict contains a matrix of state changes with the values defining
    # if the change is allowed or not
    STATE_CHANGES = {
        'pending': {'coalesced': True, 'completed': True, 'running': True},
        'running': {'coalesced': True, 'completed': True, 'pending': False},
        'completed': {'coalesced': False, 'pending': False, 'running': False},
        'coalesced': {'completed': False, 'pending': False, 'running': False}
    }

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
        iter_obj = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job",
            placeholders=[id],
            debug_show=self.DEBUG,
            replace=repl,
            return_type='iter',
        )
        return self.as_single(iter_obj, "job", id=id)

    def get_job_id_by_guid(self, job_guid):
        """Return the job id for this ``job_guid``"""
        iter_obj = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job_id_by_guid",
            placeholders=[job_guid],
            debug_show=self.DEBUG,
            return_type='iter'
        )
        obj = self.as_single(iter_obj, "job", job_guid=job_guid)
        return obj['id']

    def get_job_list(self, offset, limit):
        """
        Retrieve a list of jobs.
        Mainly used by the restful api to list the jobs
        """
        proc = "jobs.selects.get_job_list"
        iter_obj = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=[offset, limit],
            debug_show=self.DEBUG,
            return_type='iter'
        )

        return self.as_list(iter_obj, "job")

    def set_state(self, job_id, state):
        """Update the state of an existing job"""
        self.get_jobs_dhub().execute(
            proc='jobs.updates.set_state',
            placeholders=[state, job_id],
            debug_show=self.DEBUG
        )

    def get_log_references(self, job_id):
        """Return the log references for the given ``job_id``."""
        iter_obj = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_log_references",
            placeholders=[job_id],
            debug_show=self.DEBUG,
            return_type='iter',
        )
        return self.as_list(iter_obj, "job_log_url", job_id=job_id)

    def get_job_artifact_references(self, job_id):
        """
        Return the job artifact references for the given ``job_id``.

        This is everything about the artifact, but not the artifact blob
        itself.
        """
        iter_obj = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job_artifact_references",
            placeholders=[job_id],
            debug_show=self.DEBUG,
            return_type='iter',
        )
        return self.as_list(iter_obj, "job_artifacts", job_id=job_id)

    def get_job_artifact(self, id):
        """Return the job artifact blob by id."""
        iter_obj = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job_artifact",
            placeholders=[id],
            debug_show=self.DEBUG,
            return_type='iter',
        )
        return self.as_single(iter_obj, "job_artifacts", id=id)

    def get_job_note(self, id):
        """Return the job note by id."""
        iter_obj = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job_note",
            placeholders=[id],
            debug_show=self.DEBUG,
            return_type='iter',
        )
        return self.as_single(iter_obj, "job_note", id=id)

    def get_job_note_list(self, job_id):
        """Return the job notes by job_id."""
        iter_obj = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job_note_list",
            placeholders=[job_id],
            debug_show=self.DEBUG,
            return_type='iter',
        )
        return self.as_list(iter_obj, "job_notes", job_id=job_id)

    def insert_job_note(self, job_id, failure_classification_id, who, note):
        """insert a new note for the job"""
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

        return self.get_jobs_dhub().execute(
            proc='jobs.selects.get_result_set_ids',
            placeholders=revision_hashes,
            replace=[where_in_list],
            debug_show=self.DEBUG,
            key_column='revision_hash',
            return_type='dict')

    def get_revision_id(self, revision, repository_id):
        """Return the ``revision.id`` for the given ``revision``"""
        iter_obj = self.get_jobs_dhub().execute(
            proc='jobs.selects.get_revision_id',
            placeholders=[revision, repository_id],
            debug_show=self.DEBUG,
            return_type='iter')

        return self.as_single(iter_obj, "revision",
                              revision_hash=revision,
                              repository_id=repository_id)

    def _get_revision_map_id(self, revision_id, result_set_id):
        """
        Return the ``revision_map.id``
        for the given ``revision_id`` and ``result_set_id``
        """
        id_iter = self.get_jobs_dhub().execute(
            proc='jobs.selects.get_revision_map_id',
            placeholders=[revision_id, result_set_id],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_result_set_list(self, offset, limit, **kwargs):
        """
        Retrieve a list of ``result_sets`` (also known as ``pushes``)
        with associated revisions.  No jobs

        Mainly used by the restful api to list the pushes in the UI
        """
        placeholders = []
        replace_str = ""

        if "author" in kwargs:
            replace_str += " AND revision.author = %s"
            placeholders.append(kwargs["author"])

        if "revision" in kwargs and len(kwargs["revision"]) > 5:
            replace_str += " AND revision.revision = %s"
            placeholders.append(kwargs["revision"])

        # If a push doesn't have jobs we can just
        # message the user, it would save us a very expensive join
        # with the jobs table.

        #TODO: Remove if this is not necessary
        if "exclude_empty" in kwargs and int(kwargs["exclude_empty"]) == 1:
            replace_str += " AND job.id is not null"

        placeholders.extend([offset, limit])

        # Retrieve the filtered/limited list of result sets
        proc = "jobs.selects.get_result_set_list"
        result_set_ids = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=placeholders,
            debug_show=self.DEBUG,
            replace=[replace_str]
        )

        aggregate_details = self.get_result_set_details(result_set_ids)
        
        # Construct the return dataset, include all revisions associated
        # with each result_set in the revision_list attribute
        return_list = []
        for result in result_set_ids:

            detail = aggregate_details[ result['id'] ][0]

            return_list.append(
                {
                    "id":result['id'],
                    "revision_hash":result['revision_hash'],
                    "push_timestamp":result['push_timestamp'],
                    "repository_id":detail['repository_id'],
                    "revision":detail['revision'],
                    "author":detail['author'],
                    "comments":detail['comments'],
                    "revision_list":aggregate_details[ result['id'] ]
                    }
                )
                    
        return self.as_list(return_list, "result_set", **kwargs)

    def get_result_set_details(self, result_set_ids):
        """
        Retrieve all revisions associated with a set of ``result_set`` (also known as ``pushes``)
        ids.

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

    def get_result_set_job_list(self, result_set_id, **kwargs):
        """
        Retrieve a list of ``jobs`` and results for a result_set.

        Mainly used by the restful api to list the job results in the UI
        """
        repl = [self.refdata_model.get_db_name()]
        if "job_type_name" in kwargs:
            repl.append(" AND jt.`name` = '{0}'".format(kwargs["job_type_name"]))

        proc = "jobs.selects.get_result_set_job_list"
        iter_obj = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=[result_set_id],
            debug_show=self.DEBUG,
            return_type='iter',
            replace=repl,
        )

        return self.as_list(iter_obj, "jobs", result_set_id=result_set_id)

    def get_result_set_by_id(self, result_set_id):
        """Get a single result_set by ``id``."""
        proc = "jobs.selects.get_result_set_by_id"
        iter_obj = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=[result_set_id],
            debug_show=self.DEBUG,
            return_type='iter',
        )

        return self.as_single(iter_obj, "result_set", id=result_set_id)

    ##################
    #
    # Objectstore functionality
    #
    ##################

    def get_os_errors(self, starttime, endtime):
        """Return all the errors from the objectstore in this range."""
        return self.get_os_dhub().execute(
            proc="objectstore.selects.get_error_metadata",
            placeholders=[starttime, endtime],
            debug_show=self.DEBUG,
            return_type='dict',
            key_column="job_id"
        )

    def get_oauth_consumer_secret(self, key):
        """Consumer secret for oauth"""
        ds = self.get_datasource(self.CT_OBJECTSTORE)
        secret = ds.get_oauth_consumer_secret(key)
        return secret

    def store_job_data(self, json_data, job_guid, error=None):
        """
        Write the JSON to the objectstore to be queued for processing.
        job_guid is needed in order to decide wether the object exists or not
        """

        loaded_timestamp = utils.get_now_timestamp()
        error = "N" if error is None else "Y"
        error_msg = error or ""

        # this query inserts the object if its guid is not present,
        # otherwise it does nothing
        self.get_os_dhub().execute(
            proc='objectstore.inserts.store_json',
            placeholders=[
                loaded_timestamp,
                job_guid,
                json_data,
                error,
                error_msg,
                job_guid],
            debug_show=self.DEBUG
        )

        # this update is needed in case the object was already stored,
        # otherwise it's redundant.
        # TODO: find a way to do a conditional update
        self.get_os_dhub().execute(
            proc='objectstore.updates.update_json',
            placeholders=[
                loaded_timestamp,
                json_data,
                error,
                error_msg,
                job_guid],
            debug_show=self.DEBUG
        )

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
        Load JobData instancea into jobs db, returns job_ids and any
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

        # Structures supporting revision_hash SQL
        revision_hash_lookup = set()
        unique_revision_hashes = []
        rh_where_in = []

        # Structures supporting job SQL
        job_placeholders = []
        jobs_where_in = []

        for datum in data:
            # Make sure we can deserialize the json object
            # without raising an exception
            try:
                job_struct = JobData.from_json(datum['json_blob'])
                revision_hash = job_struct['revision_hash']
                job = job_struct['job']
            except JobDataError as e:
                self.mark_object_error(datum['id'], str(e))
                if raise_errors:
                    raise e
            except Exception as e:
                self.mark_object_error(
                    datum['id'],
                    u"Unknown error: {0}: {1}".format(
                        e.__class__.__name__, unicode(e))
                )
                if raise_errors:
                    raise e
            else:

                # json object can be sucessfully deserialized

                # Store revision_hash to support SQL construction
                # for result_set entry
                if revision_hash not in revision_hash_lookup:
                    unique_revision_hashes.append(revision_hash)
                    rh_where_in.append('%s')

                build_platform_key = self.refdata_model.add_build_platform(
                    job.get('build_platform', {}).get('os_name', 'unkown'),
                    job.get('build_platform', {}).get('platform', 'unkown'),
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
                self.refdata_model.add_job_type(job_type)

                product = job.get('product_name', 'unknown')
                self.refdata_model.add_product(product)

                job_guid = job['job_guid']
                job_placeholders.append([
                    job_guid,
                    None,                 # idx:1, job_coalesced_to_guid,
                                          # TODO: How do find this value?
                    revision_hash,        # idx:2, replace with result_set_id
                    build_platform_key,   # idx:3, replace with build_platform_id
                    machine_platform_key, # idx:4, replace with machine_platform_id
                    machine,              # idx:5, replace with machine_id
                    option_collection_hash,
                    job_type,             # idx:7, replace with job_type_id
                    product,              # idx:8, replace with product_id
                    job.get('who', 'unknown'),
                    job.get('reason', 'unknown'),
                    job.get('result', 'unknown'),
                    job.get('state', 'unknown'),
                    long( job.get('submit_timestamp') ) or None,
                    long( job.get('start_timestamp') ) or None,
                    long( job.get('end_timestamp') ) or None,
                    job_guid
                    ])

        id_lookups = self.refdata_model.set_all_reference_data()
        result_set_ids = self.get_result_set_ids(
            unique_revision_hashes, rh_where_in
            )

        for index, job in enumerate(job_placeholders):
            # Replace reference data with their ids

            # replace revision_hash with id
            job_placeholders[index][2] = result_set_ids[
                job_placeholders[index][2]
                ]['id']

            # replace build_platform_key with id
            job_placeholders[index][3] = id_lookups['build_platforms'][
                job_placeholders[index][3]
                ]['id']

            # replace build_platform_key with id
            job_placeholders[index][4] = id_lookups['machine_platforms'][
                job_placeholders[index][4]
                ]['id']

            # replace machine with id
            job_placeholders[index][5] = id_lookups['machines'][
                job_placeholders[index][5]
                ]['id']

            # replace job_type with id
            job_placeholders[index][7] = id_lookups['job_types'][
                job_placeholders[index][7]
                ]['id']

            # replace product_type with id
            job_placeholders[index][8] = id_lookups['products'][
                job_placeholders[index][8]
                ]['id']

        # Store job data
        self.get_jobs_dhub().execute(
            proc='jobs.inserts.create_job_data',
            debug_show=self.DEBUG,
            placeholders=job_placeholders,
            executemany=True )
        """
                job_placeholders.append([
                job_guid,
                job_coalesced_to_guid,
                result_set_id,
                build_platform_id,
                machine_platform_id,
                machine_id,
                option_collection_hash,
                job_type_id,
                product_id,
                who,
                reason,
                result,
                state,
                submit_timestamp,
                start_timestamp,
                end_timestamp,
                job_guid

                    ])
        job_type_id = rdm.get_or_create_job_type(
            job_name
        )

        job_id = self._set_job_data(
            job,
            result_set_id,
            build_platform_id,
            machine_platform_id,
            machine_id,
            option_collection_hash,
            job_type_id,
            product_id,
        )

        for log_ref in job["log_references"]:
            self._insert_job_log_url(
                job_id,
                log_ref["name"],
                log_ref["url"]
            )

        # importing here to avoid a dep loop
        from treeherder.log_parser.tasks import parse_log

        if job["log_references"]:
            # if we have a log to parse, we also have a result
            # send a parse-log task for this job
            check_errors = job["result"] != "success"
            parse_log.delay(self.project, job_id, check_errors=check_errors)

        try:
            artifact = job["artifact"]
            self.insert_job_artifact(
                job_id,
                artifact["name"],
                artifact["type"],
                artifact["blob"],
            )

            for log_ref in artifact["log_urls"]:
                self._insert_job_log_url(
                    job_id,
                    log_ref["name"],
                    log_ref["url"]
                )

        except (KeyError, JobDataError):
            # it is ok to have an empty or missing artifact
            pass
        """

    def _get_or_create_result_set(self, revision_hash, push_timestamp):
        """
        Set result set revision hash.
        If it already exists, return the id for that ``revision_hash``.
        """

        self._insert_data(
            'set_result_set',
            [
                revision_hash,
                long(push_timestamp),
                revision_hash,
            ]
        )
        result_set_id = self.get_result_set_id(revision_hash)
        return result_set_id['id']

    def _get_or_create_revision(self, params):
        """
        Insert a source to the ``revision`` table

        Example params:
        {
            "commit_timestamp": 1365732271, # this is nullable
            "comments": "Bug 854583 - Use _pointer_ instead of...",
            "repository": "mozilla-aurora",
            "revision": "c91ee0e8a980",
            "files": [
                "file1",
                "file2"
            ]
        }

        """

        repository_id = self.refdata_model.get_repository_id(
            params["repository"]
        )

        files = json.dumps(params['files'])

        commit_timestamp = params.get("commit_timestamp", False) or 0

        self._insert_data(
            'set_revision',
            [
                params["revision"],
                params['author'],
                params.get("comments", ""),
                files,
                long(commit_timestamp),
                repository_id,
                params["revision"],
                repository_id
            ]
        )

        return self.get_revision_id(params["revision"], repository_id)['id']

    def _get_or_create_revision_map(self, revision_id, result_set_id):
        """
        Create a mapping between revision and result_set.

        Return: nothing
        """
        self._insert_data(
            'set_revision_map',
            [
                revision_id,
                result_set_id,
                revision_id,
                result_set_id,
            ]
        )

        return self._get_revision_map_id(revision_id, result_set_id)

    def _set_job_data(self, data, result_set_id, build_platform_id,
                      machine_platform_id, machine_id, option_collection_hash,
                      job_type_id, product_id):
        """Inserts job data into the db and returns job id."""

        try:
            job_guid = data["job_guid"]

            # @@@ jeads: not sure about job_coalesced_to_guid.
            # According to the sample data, this could be:
            #
            #  coalesced: [
            #     "job_guid",
            #     ...
            # ]
            #
            # I think I need an
            # example of this in job_data.txt

            job_coalesced_to_guid = ""

            # TODO: fix who and reason for pending/running jobs
            who = data.get("who", "unknown")
            reason = data.get("reason", "unknown")
            result = data.get("result", "unknown")
            state = data["state"]
            submit_timestamp = long(data["submit_timestamp"])
            start_timestamp = long(data.get("start_timestamp", 0)) or None
            end_timestamp = long(data.get("end_timestamp", 0)) or None

        except ValueError as e:
            raise JobDataError(e.message)

        # try to insert a new row
        self._insert_data(
            'create_job_data',
            [
                job_guid,
                job_coalesced_to_guid,
                result_set_id,
                build_platform_id,
                machine_platform_id,
                machine_id,
                option_collection_hash,
                job_type_id,
                product_id,
                who,
                reason,
                result,
                state,
                submit_timestamp,
                start_timestamp,
                end_timestamp,
                job_guid
            ]
        )

        job_id = self.get_job_id_by_guid(job_guid)

        job_info = self.get_job(job_id)

        # in this case do nothing
        if state != 'pending':
            # update state to running
            if state == 'running' and job_info['state'] == 'pending':
                self.set_state(job_id, 'running')
            elif state == 'finished' and job_info['state'] != state:
                self._update_data(
                    'update_job_data',
                    [
                        job_coalesced_to_guid,
                        result_set_id,
                        machine_id,
                        option_collection_hash,
                        job_type_id,
                        product_id,
                        who,
                        reason,
                        result,
                        state,
                        start_timestamp,
                        end_timestamp,
                        job_id
                    ]
                )

        return job_id

    def _insert_job_log_url(self, job_id, name, url):
        """Insert job log data"""

        self._insert_data(
            'set_job_log_url',
            [
                job_id, name, url
            ]
        )

    def insert_job_artifact(self, job_id, name, artifact_type, blob):
        """Insert job artifact """

        self._insert_data(
            'set_job_artifact',
            [
                job_id, name, artifact_type, blob
            ]
        )

    def _insert_data(self, statement, placeholders, executemany=False):
        """Insert a set of data using the specified proc ``statement``."""
        self.get_jobs_dhub().execute(
            proc='jobs.inserts.' + statement,
            debug_show=self.DEBUG,
            placeholders=placeholders,
            executemany=executemany,
        )

    def _update_data(self, statement, placeholders):
        """Update a set of data using the specified proc ``statement``."""
        self.get_jobs_dhub().execute(
            proc='jobs.updates.' + statement,
            debug_show=self.DEBUG,
            placeholders=placeholders,
            executemany=False,
        )

    def _insert_data_and_get_id(self, statement, placeholders):
        """Execute given insert statement, returning inserted ID."""
        self._insert_data(statement, placeholders)
        return self._get_last_insert_id()

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
        #   any objects in a suspended state as errored
        self.load_job_data(rows)

        """
        for row in rows:
            row_id = int(row['id'])
            try:
                data = JobData.from_json(row['json_blob'])
                self.load_job_data(data)
                revision_hash = data["revision_hash"]
            except JobDataError as e:
                self.mark_object_error(row_id, str(e))
                if raise_errors:
                    raise e
            except Exception as e:
                self.mark_object_error(
                    row_id,
                    u"Unknown error: {0}: {1}".format(
                        e.__class__.__name__, unicode(e))
                )
                if raise_errors:
                    raise e
            else:
                self.mark_object_complete(row_id, revision_hash)
        """

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

    def mark_object_complete(self, object_id, revision_hash):
        """ Call to database to mark the task completed """
        self.get_os_dhub().execute(
            proc="objectstore.updates.mark_complete",
            placeholders=[revision_hash, object_id],
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
        iter_obj = self.get_os_dhub().execute(
            proc="objectstore.selects.get_json_blob_by_guid",
            placeholders=[guid],
            debug_show=self.DEBUG,
            return_type='iter',
        )
        return self.as_single(iter_obj, "objectstore", guid=guid)

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

class JobDataError(ValueError):
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
