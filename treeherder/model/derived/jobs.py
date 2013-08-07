import json
import MySQLdb

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

    def get_os_dhub(self):
        """Get the dhub for the objectstore"""
        return self.get_dhub(self.CT_OBJECTSTORE)

    def get_job(self, job_id):
        """Return the job row for this ``job_id``"""
        return self.get_row_by_id(self.CT_JOBS, "job", job_id)

    def get_job_id_by_guid(self, job_guid):
        """Return the job id for this ``job_guid``"""
        id_iter = self.get_jobs_dhub().execute(
            proc="jobs.selects.get_job_id_by_guid",
            placeholders=[job_guid],
            debug_show=self.DEBUG,
            return_type='iter'
        )
        return id_iter.get_column_data('id')

    def get_job_list(self, page, limit):
        """
        Retrieve a list of jobs.
        Mainly used by the restful api to list the jobs
        """
        proc = "jobs.selects.get_job_list"
        json_blobs = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=[page, limit],
            debug_show=self.DEBUG,
            return_type='iter'
        )

        return json_blobs

    def set_state(self, job_id, state):
        """Update the state of an existing job"""
        self.get_jobs_dhub().execute(
            proc='jobs.updates.set_state',
            placeholders=[state, job_id],
            debug_show=self.DEBUG
        )

    def get_log_references(self, job_id):
        """Return the log references for the given ``job_id``."""
        return self.get_jobs_dhub().execute(
            proc="jobs.selects.get_log_references",
            placeholders=[job_id],
            debug_show=self.DEBUG,
            return_type='iter',
        )

    def get_result_set_id(self, revision_hash):
        """Return the ``result_set.id`` for the given ``revision_hash``"""
        id_iter = self.get_jobs_dhub().execute(
            proc='jobs.selects.get_result_set_id',
            placeholders=[revision_hash],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_revision_id(self, revision):
        """Return the ``revision.id`` for the given ``revision``"""
        id_iter = self.get_jobs_dhub().execute(
            proc='jobs.selects.get_revision_id',
            placeholders=[revision],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_result_set_list(self, page, limit, **kwargs):
        """
        Retrieve a list of ``result_sets`` (also known as ``pushes``)
        with associated revisions.  No jobs

        Mainly used by the restful api to list the pushes in the UI
        """
        repl = [""]
        if "author" in kwargs:
            repl = [" AND `rev`.`author` = '{0}'".format(kwargs["author"])]

        proc = "jobs.selects.get_result_set_list"
        push_dict = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=[page, limit],
            debug_show=self.DEBUG,
            return_type='iter',
            replace=repl,
        )

        return push_dict

    def get_result_set_job_list(self, result_set_id, **kwargs):
        """
        Retrieve a list of ``jobs`` and results for a result_set.

        Mainly used by the restful api to list the job results in the UI
        """
        repl = [""]
        if "job_type_name" in kwargs:
            repl = [" AND jt.`name` = '{0}'".format(kwargs["job_type_name"])]

        proc = "jobs.selects.get_result_set_job_list"
        push_dict = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=[result_set_id],
            debug_show=self.DEBUG,
            return_type='iter',
            replace=repl,
        )

        return push_dict

    def get_result_set_by_id(self, result_set_id):
        """Get a single result_set by ``id``."""
        proc = "jobs.selects.get_result_set_by_id"
        job_dict = self.get_jobs_dhub().execute(
            proc=proc,
            placeholders=[result_set_id],
            debug_show=self.DEBUG,
            return_type='iter',
        )

        return job_dict

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

    def load_job_data(self, data):
        """
        Load JobData instance into jobs db, return job_id.

        Example:
            {
                "sources": [
                    {
                        "commit_timestamp": 1365732271,
                        "push_timestamp": 1365732271,
                        "comments": "Bug 854583 - Use _pointer_ instead of...",
                        "repository": "mozilla-aurora",
                        "revision": "c91ee0e8a980"
                    }
                ],
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

        """
        # @@@ ``push_timestamp`` will come from a different location in the
        # data structure in the future.  most likely at the top-level,
        # rather than inside ``sources``
        result_set_id = self._get_or_create_result_set(
            data["revision_hash"],
            data["sources"][0].get("push_timestamp", 0),
        )

        rdm = self.refdata_model
        job = data["job"]

        # set sources

        for src in data["sources"]:
            revision_id = self._get_or_create_revision(src, job["who"])
            self._get_or_create_revision_map(revision_id, result_set_id)

        # set Job data

        build_platform_id = rdm.get_or_create_build_platform(
            job["build_platform"]["os_name"],
            job["build_platform"]["platform"],
            job["build_platform"]["architecture"],
        )

        machine_platform_id = rdm.get_or_create_machine_platform(
            job["machine_platform"]["os_name"],
            job["machine_platform"]["platform"],
            job["machine_platform"]["architecture"],
        )

        if "machine" in job:
            machine_id = rdm.get_or_create_machine(
                job["machine"],
                timestamp=long(job["end_timestamp"]),
            )
        else:
            machine_id = None

        option_collection_hash = rdm.get_or_create_option_collection(
            [k for k, v in job["option_collection"].items() if v],
        )

        job_group, sep, job_name = job["name"].partition("-")

        job_type_id = rdm.get_or_create_job_type(
            job_name, job_group,
        )

        if "product_name" in job:
            product_id = rdm.get_or_create_product(
                job["product_name"],
            )
        else:
            product_id = None

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

        # send a parse-log task for this job
        parse_log.delay(self.project, job_id)

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
        return result_set_id

    def _get_or_create_revision(self, src, author):
        """
        Insert a source to the ``revision`` table

        Example source:
        {
            "commit_timestamp": 1365732271,
            "comments": "Bug 854583 - Use _pointer_ instead of...",
            "repository": "mozilla-aurora",
            "revision": "c91ee0e8a980"
        }

        """
        repository_id = self.refdata_model.get_repository_id(
            src["repository"])

        self._insert_data(
            'set_revision',
            [
                src["revision"],
                author,
                src.get("comments", ""),
                long(src.get("commit_timestamp", 0)),
                repository_id,
                src["revision"],
            ]
        )
        return self.get_revision_id(src["revision"])

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
        return self.get_os_dhub().execute(
            proc="objectstore.selects.get_json_blob_by_guid",
            placeholders=[guid],
            debug_show=self.DEBUG
        )

    def get_json_blob_list(self, page, limit):
        """
        Retrieve JSON blobs from the objectstore.
        Mainly used by the restful api to list the last blobs stored
        """
        proc = "objectstore.selects.get_json_blob_list"
        json_blobs = self.get_os_dhub().execute(
            proc=proc,
            placeholders=[page, limit],
            debug_show=self.DEBUG,
            return_type='tuple'
        )

        return json_blobs


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
