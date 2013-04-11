import json
import MySQLdb

from warnings import filterwarnings, resetwarnings
from django.conf import settings

from treeherder.model.models import Datasource
from treeherder.model import utils

from .refdata import RefDataManager
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


    @classmethod
    def create(cls, project, hosts=None, types=None):
        """
        Create all the datasource tables for this project.

        ``hosts`` is an optional dictionary mapping contenttype names to the
        database server host on which the database for that contenttype should
        be created. Not all contenttypes need to be represented; any that
        aren't will use the default (``TREEHERDER_DATABASE_HOST``).

        ``types`` is an optional dictionary mapping contenttype names to the
        type of database that should be created. For MySQL/MariaDB databases,
        use "MySQL-Engine", where "Engine" could be "InnoDB", "Aria", etc. Not
        all contenttypes need to be represented; any that aren't will use the
        default (``MySQL-InnoDB``).


        """
        hosts = hosts or {}
        types = types or {}

        for ct in cls.CONTENT_TYPES:
            Datasource.create(
                project,
                ct,
                host=hosts.get(ct),
                db_type=types.get(ct),
                )

        return cls(project=project)


    def get_oauth_consumer_secret(self, key):
        ds = self.sources[self.CT_OBJECTSTORE].datasource
        secret = ds.get_oauth_consumer_secret(key)
        return secret


    def _get_last_insert_id(self, source=None):
        """Return last-inserted ID."""
        if not source:
            source = self.CT_JOBS
        return self.sources[source].dhub.execute(
            proc='generic.selects.get_last_insert_id',
            debug_show=self.DEBUG,
            return_type='iter',
            ).get_column_data('id')


    def store_job_data(self, json_data, error=None):
        """Write the JSON to the objectstore to be queued for processing."""

        loaded_timestamp = utils.get_now_timestamp()
        error = "N" if error is None else "Y"
        error_msg = error or ""

        self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc='objectstore.inserts.store_json',
            placeholders=[loaded_timestamp, json_data, error, error_msg],
            debug_show=self.DEBUG
        )

        return self._get_last_insert_id()


    def retrieve_job_data(self, limit):
        """
        Retrieve JSON blobs from the objectstore.

        Does not claim rows for processing; should not be used for actually
        processing JSON blobs into perftest schema.

        Used only by the `transfer_data` management command.

        """
        proc = "objectstore.selects.get_unprocessed"
        json_blobs = self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc=proc,
            placeholders=[limit],
            debug_show=self.DEBUG,
            return_type='tuple'
        )

        return json_blobs


    def load_job_data(self, data):
        """
        Load JobData instance into jobs db, return job_id.

        @@@: should I return the job_guid instead?

        Example:
        {
            'sources': {
                u'mozilla-inbound': u'0a8bfba4d8e1'
            },
            'revision_hash': 'c62affca07712188082a1aa70ef5a7ce61aed501',
            'jobs': [
                {
                    'build_platform': {
                        'platform': 'WINNT5.1',
                        'os_name': 'win',
                        'architecture': 'x86',
                        'vm': False
                    },
                    'submit_timestamp': 1365036568,
                    'start_timestamp': u'20130403163448',
                    'name': u'mochitest-5',
                    'option_collection': {
                        'debug': True
                    },
                    'log_references': [
                        {
                            'url': u'http: //ftp.mozilla.org/pub/mozilla.org/firefox/tinderbox-builds/mozilla-inbound-win32-debug/1365032088/mozilla-inbound_xp-debug_test-mochitest-5-bm46-tests1-windows-build114.txt.gz',
                            'name': 'unittest'
                        }
                    ],
                    'who': u'sendchange-unittest',
                    'reason': u'scheduler',
                    'artifact': {

                    },
                    'machine_platform': {
                        'platform': 'WINNT5.1',
                        'os_name': 'win',
                        'architecture': 'x86',
                        'vm': False
                    },
                    'machine': u'talos-r3-xp-088',
                    'state': 'TODO',
                    'result': 0,
                    'job_guid': 'f3e3a9e6526881c39a3b2b6ff98510f213b3d4ed',
                    'product_name': u'firefox',
                    'end_timestamp': '1365038362'
                }
            ]
        }

        """

        # Get/Set reference info, all inserts use ON DUPLICATE KEY

        # @@@ tempted to coalesce these ids into a dict to pass to _set_job_data...
        rdm = RefDataManager(self.project)

        build_platform_id = rdm.get_or_create_build_platform(
            **data["jobs"]["build_platform"])
        machine_platform_id = rdm.get_or_create_machine_platform(
            **data["jobs"]["machine_platform"])
        machine_id = rdm.get_or_create_machine(
            data["machine"],
        )
        # @@@ need to straighten out with mdoglio
        option_collection_id = rdm.get_or_create_option_collection(
            data)

        # @@@ need these fields in the job structure
        job_type_id = rdm.get_or_create_job_type(data)
        product_id = rdm.get_or_create_product(
            data["jobs"]["product_name"],
        )

        # Insert job data.
        result_set_id = self._set_result_set(data["revision_hash"])

        job_id = self._set_job_data(
            data,
            result_set_id,
            build_platform_id,
            machine_platform_id,
            machine_id,
            option_collection_id,
            job_type_id,
            product_id,
        )

        return job_id


    def _set_result_set(self, revision_hash):

        job_id = self._insert_data_and_get_id(
            'set_result_set',
            [
                revision_hash,
            ]
        )

        return job_id



    def _set_job_data(self, data, result_set_id, build_platform_id,
                      machine_platform_id, machine_id, option_collection_id,
                      job_type_id, product_id):
        """Inserts job data into the db and returns test_run id."""

        try:
            job_guid = data["job_guid"]

            # @@@ not sure about this one
            job_coalesced_to_guid = ""

            who = data["who"]
            reason = data["reason"]
            result = int(data["result"])
            state = data["state"]
            submit_timestamp = data["submit_timestamp"]
            start_timestamp = data["start_timestamp"]
            end_timestamp = data["end_timestamp"]

        # @@@ need better error message here
        except ValueError:
            raise JobDataError(
                "Return meaningful error here; not this rubbish.")

        job_id = self._insert_data_and_get_id(
            'set_job_data',
            [
                job_guid,
                job_coalesced_to_guid,
                result_set_id,
                build_platform_id,
                machine_platform_id,
                machine_id,
                option_collection_id,
                job_type_id,
                product_id,
                who,
                reason,
                result,
                state,
                submit_timestamp,
                start_timestamp,
                end_timestamp,
                ]
        )

        return job_id


    def _insert_data(self, statement, placeholders, executemany=False):
        self.sources["perftest"].dhub.execute(
            proc='perftest.inserts.' + statement,
            debug_show=self.DEBUG,
            placeholders=placeholders,
            executemany=executemany,
            )


    def _insert_data_and_get_id(self, statement, placeholders):
        """Execute given insert statement, returning inserted ID."""
        self._insert_data(statement, placeholders)
        return self._get_last_insert_id()


    def _get_last_insert_id(self, source="perftest"):
        """Return last-inserted ID."""
        return self.sources[source].dhub.execute(
            proc='generic.selects.get_last_insert_id',
            debug_show=self.DEBUG,
            return_type='iter',
            ).get_column_data('id')


    def process_objects(self, loadlimit):
        """Processes JSON blobs from the objectstore into perftest schema."""
        rows = self.claim_objects(loadlimit)
        test_run_ids_loaded = []

        for row in rows:
            row_id = int(row['id'])
            try:
                data = JobData.from_json(row['json_blob'])
                test_run_id = self.load_job_data(data)
            except JobDataError as e:
                self.mark_object_error(row_id, str(e))
            except Exception as e:
                self.mark_object_error(
                    row_id,
                    u"Unknown error: {0}: {1}".format(
                        e.__class__.__name__, unicode(e))
                )
            else:
                self.mark_object_complete(row_id, test_run_id)
                test_run_ids_loaded.append(test_run_id)

        return test_run_ids_loaded


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
        # deterministic/safe.  I've been unsuccessfull capturing the specific
        # warning generated without redirecting program flow control.  To
        # ressolve the problem in production, we're disabling MySQLdb.Warnings
        # before executing mark_loading and then re-enabling warnings
        # immediately after.  If this bug is ever fixed in mysql this handling
        # should be removed. Holy Hackery! -Jeads
        filterwarnings('ignore', category=MySQLdb.Warning)

        # Note: this claims rows for processing. Failure to call load_job_data
        # on this data will result in some json blobs being stuck in limbo
        # until another worker comes along with the same connection ID.
        self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc=proc_mark,
            placeholders=[limit],
            debug_show=self.DEBUG,
            )

        resetwarnings()

        # Return all JSON blobs claimed by this connection ID (could possibly
        # include orphaned rows from a previous run).
        json_blobs = self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc=proc_get,
            debug_show=self.DEBUG,
            return_type='tuple'
        )

        return json_blobs


    def mark_object_complete(self, object_id, job_id):
        """ Call to database to mark the task completed """
        self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc="objectstore.updates.mark_complete",
            placeholders=[job_id, object_id],
            debug_show=self.DEBUG
        )


    def mark_object_error(self, object_id, error):
        """ Call to database to mark the task completed """
        self.sources[self.CT_OBJECTSTORE].dhub.execute(
            proc="objectstore.updates.mark_error",
            placeholders=[error, object_id],
            debug_show=self.DEBUG
        )


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
