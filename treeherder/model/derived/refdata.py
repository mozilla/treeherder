import logging
import os
import time
from datetime import (datetime,
                      timedelta)
from hashlib import sha1

from datasource.bases.BaseHub import BaseHub
from datasource.DataHub import DataHub
from django.conf import settings

from treeherder.model import utils

logger = logging.getLogger(__name__)


class RefDataManager(object):

    """Model for reference data"""

    def __init__(self):
        procs_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'sql', 'reference.json')

        master_host_config = {
            "host": settings.DATABASES['default']['HOST'],
            "user": settings.DATABASES['default']['USER'],
            "passwd": settings.DATABASES['default']['PASSWORD']
        }
        if 'OPTIONS' in settings.DATABASES['default']:
            master_host_config.update(settings.DATABASES['default']['OPTIONS'])

        read_host_config = {
            "host": settings.DATABASES['read_only']['HOST'],
            "user": settings.DATABASES['read_only']['USER'],
            "passwd": settings.DATABASES['read_only']['PASSWORD']
        }
        if 'OPTIONS' in settings.DATABASES['read_only']:
            read_host_config.update(settings.DATABASES['read_only']['OPTIONS'])

        data_source = {
            'reference': {
                "hub": "MySQL",
                "master_host": master_host_config,
                "read_host": read_host_config,
                "require_host_type": True,
                "default_db": settings.DATABASES['default']['NAME'],
                "procs": [procs_path]
            }
        }

        BaseHub.add_data_source(data_source)
        self.dhub = DataHub.get("reference")
        self.DEBUG = settings.DEBUG

        # Support structure for reference data signatures
        self.reference_data_signature_lookup = {}
        self.build_signature_placeholders = []

        # Support structures for building build platform SQL
        self.build_platform_lookup = {}
        self.build_where_filters = []
        self.build_platform_placeholders = []
        self.build_unique_platforms = []

        # Support structures for building machine platform SQL
        self.machine_platform_lookup = {}
        self.machine_where_filters = []
        self.machine_platform_placeholders = []
        self.machine_unique_platforms = []

        # Support structures for building job group SQL
        self.job_group_lookup = {}
        self.job_group_where_filters = []
        self.job_group_placeholders = []
        self.job_group_names_and_symbols = []

        # Support structures for building job types SQL
        self.job_type_lookup = {}
        self.job_type_where_filters = []
        self.job_type_placeholders = []
        self.job_type_names_and_symbols = []

        # Use this structure to map the job to the group id
        self.job_type_to_group_lookup = {}

        # Support structures for building product SQL
        self.product_lookup = set()
        self.product_where_in_list = []
        self.product_placeholders = []
        self.unique_products = []

        # Support structures for building device SQL
        self.device_lookup = set()
        self.device_where_in_list = []
        self.device_placeholders = []
        self.unique_devices = []

        # Support structures for building machine SQL
        self.machine_name_lookup = set()
        self.machine_where_in_list = []
        self.machine_name_placeholders = []
        self.machine_unique_names = []
        self.machine_timestamp_update_placeholders = []

        # Support structures for building option collection data structures
        self.oc_hash_lookup = dict()
        self.oc_where_in_list = []
        self.oc_placeholders = []
        self.oc_unique_collections = []

        # Support structures for building option data structures
        self.o_lookup = set()
        self.o_placeholders = []
        self.o_unique_options = []
        self.o_where_in_list = []

        # reference id lookup structure
        self.id_lookup = {}

    def disconnect(self):
        self.dhub.disconnect()

    def __enter__(self):
        return self

    def __exit__(self, type, value, traceback):
        self.disconnect()

    def execute(self, **kwargs):
        return utils.retry_execute(self.dhub, logger, **kwargs)

    def set_all_reference_data(self):
        """This method executes SQL to store data in all loaded reference
           data structures. It returns lookup dictionaries where the key is
           typically the string provided to the data structure and the value
           includes the database id associated with it. Once all of the
           reference data is processed, the reference data structures are
           initialized to empty structures so the same class instance can be
           used to process more reference data if necessary.

           In general, users of this class should first iterate through job
           data, calling appropriate add* class instance methods to load the
           reference data once all of the data is loaded, call this method
           to process the data.
        """

        # This is not really an id lookup but a list of unique reference
        # data signatures that can be used for subsequent queries
        self.id_lookup['reference_data_signatures'] = self.process_reference_data_signatures()

        # id lookup structure
        self.id_lookup['build_platforms'] = self.process_build_platforms()
        self.id_lookup['machine_platforms'] = self.process_machine_platforms()

        # job groups need to be processed before job types so the associated
        # group ids are available when the job types are stored
        self.id_lookup['job_groups'] = self.process_job_groups()
        self.id_lookup['job_types'] = self.process_job_types()

        self.id_lookup['products'] = self.process_products()
        self.id_lookup['machines'] = self.process_machines()
        self.id_lookup['devices'] = self.process_devices()

        self.id_lookup['option_collections'] = self.process_option_collections()

        self.reset_reference_data()

        return self.id_lookup

    def reset_reference_data(self):
        """Reset all reference data structures, this should be called after
           processing data.
        """

        # reference data signatures
        self.reference_data_signature_lookup = {}
        self.build_signature_placeholders = []

        # reset build platforms
        self.build_platform_lookup = {}
        self.build_where_filters = []
        self.build_platform_placeholders = []
        self.build_unique_platforms = []

        # reset machine platforms
        self.machine_platform_lookup = {}
        self.machine_where_filters = []
        self.machine_platform_placeholders = []
        self.machine_unique_platforms = []

        # reset job groups
        self.job_group_lookup = {}
        self.job_group_where_filters = []
        self.job_group_placeholders = []
        self.job_group_names_and_symbols = []

        self.job_type_to_group_lookup = {}

        # reset job types
        self.job_type_lookup = {}
        self.job_type_where_filters = []
        self.job_type_placeholders = []
        self.job_type_names_and_symbols = []

        # reset products
        self.product_lookup = set()
        self.product_where_in_list = []
        self.product_placeholders = []
        self.unique_products = []

        # reset devices
        self.device_lookup = set()
        self.device_where_in_list = []
        self.device_placeholders = []
        self.unique_devices = []

        # reset machines
        self.machine_name_lookup = set()
        self.machine_where_in_list = []
        self.machine_name_placeholders = []
        self.machine_unique_names = []
        self.machine_timestamp_update_placeholders = []

        # reset option collections
        self.oc_hash_lookup = dict()
        self.oc_where_in_list = []
        self.oc_placeholders = []
        self.oc_unique_collections = []

        # reset options
        self.o_lookup = set()
        self.o_placeholders = []
        self.o_unique_options = []
        self.o_where_in_list = []

    """
    Collection of add_* methods that take some kind of reference
    data and populate a set of class instance data structures. These
    methods allow a caller to iterate through a single list of
    job data structures, generating cumulative sets of reference data.
    """

    def add_reference_data_signature(self, name, build_system_type,
                                     repository, reference_data):

        signature = self.get_reference_data_signature(reference_data)

        if signature not in self.reference_data_signature_lookup:

            # No reference_data_name was provided use the signature
            # in it's place, in the case of buildbot this will be the
            # buildername
            if name is None:
                name = signature

            placeholders = [name, signature]
            placeholders.extend(reference_data)
            placeholders.extend([int(time.time()), name, signature,
                                 build_system_type, repository])
            self.build_signature_placeholders.append(placeholders)

            self.reference_data_signature_lookup[signature] = reference_data

        return signature

    def add_build_platform(self, os_name, platform, arch):
        """
        Add build platform reference data. Requires an
        operating system name, platform designator, and architecture
        type.

        os_name - linux | mac | win | Android | Firefox OS | ...
        platform - fedora 12 | redhat 12 | 5.1.2600 | 6.1.7600 | OS X 10.7.2 | ...
        architecture - x86 | x86_64 etc...
        """
        os_name = os_name or 'unknown'
        platform = platform or 'unknown'
        arch = arch or 'unknown'

        max_len = 25

        os_name = os_name[0:max_len]
        platform = platform[0:max_len]
        arch = arch[0:max_len]

        key = self._add_platform(
            os_name, platform, arch,
            self.build_platform_lookup,
            self.build_platform_placeholders,
            self.build_unique_platforms,
            self.build_where_filters
        )

        return key

    def add_machine_platform(self, os_name, platform, arch):
        """
        Add machine platform reference data. Requires an
        operating system name, platform designator, and architecture
        type.

        os_name - linux | mac | win | Android | Firefox OS | ...
        platform - fedora 12 | redhat 12 | 5.1.2600 | 6.1.7600 | OS X 10.7.2 | ...
        architecture - x86 | x86_64 etc...
        """
        os_name = os_name or 'unknown'
        platform = platform or 'unknown'
        arch = arch or 'unknown'

        max_len = 25

        os_name = os_name[0:max_len]
        platform = platform[0:max_len]
        arch = arch[0:max_len]

        key = self._add_platform(
            os_name, platform, arch,
            self.machine_platform_lookup,
            self.machine_platform_placeholders,
            self.machine_unique_platforms,
            self.machine_where_filters
        )

        return key

    def add_job_type(self, job_type, job_symbol, group_name, group_symbol):
        """Add job type names and symbols and job group names and symbols"""

        job_type = job_type or 'unknown'
        job_symbol = job_symbol or '?'

        group_name = group_name or 'unknown'
        group_symbol = group_symbol or '?'

        max_name = 100
        max_symbol = 25

        job_type = job_type[0:max_name]
        job_symbol = job_symbol[0:max_symbol]

        group_name = group_name[0:max_name]
        group_symbol = group_symbol[0:max_symbol]

        self._add_name_and_symbol(
            group_name, group_symbol, self.job_group_names_and_symbols,
            self.job_group_placeholders, self.job_group_lookup,
            self.job_group_where_filters
        )

        self._add_name_and_symbol(
            job_type, job_symbol, self.job_type_names_and_symbols,
            self.job_type_placeholders, self.job_type_lookup,
            self.job_type_where_filters
        )

        job_key = RefDataManager.get_name_symbol_key(
            job_type, job_symbol
        )

        group_key = RefDataManager.get_name_symbol_key(
            group_name, group_symbol
        )

        # Use this structure to map the job to the group id
        self.job_type_to_group_lookup[job_key] = {
            'group_key': group_key, 'job_type': job_type,
            'job_symbol': job_symbol
        }

        return job_key

    def add_product(self, product):
        """Add product names"""

        product = product or 'unknown'

        product = product[0:50]

        self._add_name(
            product, self.product_lookup, self.product_placeholders,
            self.unique_products, self.product_where_in_list
        )

    def add_device(self, device):
        """Add device names"""

        device = device or 'unknown'

        device = device[0:50]

        self._add_name(
            device, self.device_lookup, self.device_placeholders,
            self.unique_devices, self.device_where_in_list
        )

    def _add_platform(
            self,
            os_name, platform, arch,
            platform_lookup,
            platform_placeholders,
            unique_platforms,
            where_filters):
        """
        Internal method for adding platform information, the platform
        could be a build or machine platform. The caller must provide
        the appropriate instance data structures as arguments.
        """

        key = RefDataManager.get_platform_key(os_name, platform, arch)

        if key not in platform_lookup:

            # Placeholders for the INSERT/SELECT SQL query
            platform_placeholders.append(
                [os_name, platform, arch, os_name, platform, arch]
            )

            # Placeholders for the id retrieval SELECT
            unique_platforms.extend(
                [os_name, platform, arch]
            )

            # Initializing return data structure
            platform_lookup[key] = {
                'id': 0,
                'os_name': os_name,
                'platform': platform,
                'architecture': arch
            }

            # WHERE clause for the retrieval SELECT
            where_filters.append(
                "(`os_name` = %s  AND `platform` = %s  AND `architecture` = %s)".format(
                    os_name, platform, arch
                )
            )

        return key

    def _add_name(
            self, name, name_lookup, name_placeholders, unique_names,
            where_in_list):
        """
        Internal method for adding reference data that consists of a single
        name. The caller must provide the appropriate instance data
        structures as arguments.
        """
        if name not in name_lookup:

            name_lookup.add(name)

            # Placeholders for the INSERT/SELECT SQL query
            name_placeholders.append(
                [name, name]
            )

            # Placeholders for the id retrieval SELECT
            unique_names.append(name)

            # WHERE clause for the retrieval SELECT
            where_in_list.append('%s')

    def _add_name_and_symbol(
            self, name, symbol, unique_names_and_symbols, name_placeholders,
            name_symbol_lookup, where_filters):
        """
        Internal method for adding reference data that consists of a single
        name and associated character symbol. The caller must provide the
        appropriate instance data structures as arguments.
        """
        key = RefDataManager.get_name_symbol_key(name, symbol)

        if key not in name_symbol_lookup:

            # Placeholders for the INSERT/SELECT SQL query
            name_placeholders.append(
                [name, symbol, name, symbol]
            )

            # Placeholders for the id retrieval SELECT
            unique_names_and_symbols.extend(
                [name, symbol]
            )

            # Initializing return data structure
            name_symbol_lookup[key] = {
                'id': 0,
                'name': name,
                'symbol': symbol
            }

            # WHERE clause for the retrieval SELECT
            where_filters.append(
                "(`name` = %s  AND `symbol` = %s)".format(name, symbol)
            )

        return key

    def add_machine(self, machine_name, timestamp):
        """
        Add machine name and timestamp. There are two timestamps stored in
        the database for each machine, one associated with the first time
        the machine is seen and another that acts as a heartbeat for the
        machine.
        """

        if machine_name not in self.machine_name_lookup:

            machine_name = machine_name or 'unknown'
            timestamp = timestamp or time.time()

            machine_name = machine_name[0:50]

            self.machine_name_lookup.add(machine_name)

            # Placeholders for the INSERT/SELECT SQL query
            self.machine_name_placeholders.append(
                # machine_name, first_timestamp, last_timestamp,
                # machine_name
                [machine_name, timestamp, timestamp, machine_name]
            )

            # Placeholders for the id retrieval SELECT
            self.machine_unique_names.append(machine_name)

            # WHERE clause for the retrieval SELECT
            self.machine_where_in_list.append('%s')

            # NOTE: It's possible that the same machine occurs
            #   multiple times in names_and_timestamps with different
            #   timestamps. We're assuming those timestamps will be
            #   reasonably close to each other and the primary intent
            #   of storing the last_timestamp is to keep track of the
            #   approximate time a particular machine last reported.
            self.machine_timestamp_update_placeholders.append(
                [timestamp, machine_name]
            )

    def add_option_collection(self, option_set):
        """
        Add an option collection. An option collection is made up of a
        set of options. Each unique set of options is hashed, this hash
        becomes the identifier for the option set. Options are stored
        individually in the database, callers only interact directly with
        sets of options, even when there's only on option in a set.
        """

        # New set with elements in option_set but not in o_lookup
        new_options = set(option_set) - self.o_lookup

        if new_options:
            # Extend o_lookup with new options
            self.o_lookup = self.o_lookup.union(new_options)

            for o in new_options:
                # Prepare data structures for option insertion
                self.o_placeholders.append([o, o])
                self.o_unique_options.append(o)
                self.o_where_in_list.append('%s')

        option_collection_hash = self.get_option_collection_hash(
            option_set
        )

        if option_collection_hash not in self.oc_hash_lookup:
            # Build list of unique option collections
            self.oc_hash_lookup[option_collection_hash] = option_set

        return option_collection_hash

    """
    The following set of process_* methods carry out the task
    of SQL generation and execution using the class instance reference
    data structures.
    """

    def process_reference_data_signatures(self):

        insert_proc = 'reference.inserts.create_reference_data_signature'

        self.execute(
            proc=insert_proc,
            placeholders=self.build_signature_placeholders,
            executemany=True,
            debug_show=self.DEBUG)

        return self.reference_data_signature_lookup.keys()

    def process_build_platforms(self):
        """
        Process the build platform reference data
        """

        insert_proc = 'reference.inserts.create_build_platform'
        select_proc = 'reference.selects.get_build_platforms'

        return self._process_platforms(
            insert_proc, select_proc,
            self.build_platform_lookup,
            self.build_platform_placeholders,
            self.build_unique_platforms,
            self.build_where_filters
        )

    def process_machine_platforms(self):
        """
        Process the machine platform reference data
        """

        insert_proc = 'reference.inserts.create_machine_platform'
        select_proc = 'reference.selects.get_machine_platforms'

        return self._process_platforms(
            insert_proc, select_proc,
            self.machine_platform_lookup,
            self.machine_platform_placeholders,
            self.machine_unique_platforms,
            self.machine_where_filters
        )

    def process_job_groups(self):
        """
        Process the job group reference data
        """

        insert_proc = 'reference.inserts.create_job_group'
        select_proc = 'reference.selects.get_job_groups'

        return self._process_names_and_symbols(
            insert_proc, select_proc,
            self.job_group_lookup,
            self.job_group_placeholders,
            self.job_group_names_and_symbols,
            self.job_group_where_filters
        )

    def process_job_types(self):
        """
        Process the job type reference data
        """

        insert_proc = 'reference.inserts.create_job_type'
        select_proc = 'reference.selects.get_job_types'

        job_type_lookup = self._process_names_and_symbols(
            insert_proc, select_proc,
            self.job_type_lookup,
            self.job_type_placeholders,
            self.job_type_names_and_symbols,
            self.job_type_where_filters
        )

        update_placeholders = []

        # Find which job_types do not have group ids
        for job_key in job_type_lookup:

            if not job_type_lookup[job_key]['job_group_id']:
                job_data = self.job_type_to_group_lookup[job_key]
                group_id = self.job_group_lookup[job_data['group_key']]['id']
                update_placeholders.append(
                    [group_id, job_data['job_type'], job_data['job_symbol']]
                )

        if update_placeholders:
            # Update the job types with the job group id
            self.execute(
                proc='reference.updates.update_job_type_group_id',
                placeholders=update_placeholders,
                executemany=True,
                debug_show=self.DEBUG)

        return job_type_lookup

    def process_products(self):
        """
        Process the product reference data
        """

        insert_proc = 'reference.inserts.create_product'
        select_proc = 'reference.selects.get_products'

        return self._process_names(
            insert_proc, select_proc,
            self.product_where_in_list,
            self.product_placeholders,
            self.unique_products
        )

    def process_devices(self):
        """
        Process the device reference data
        """

        insert_proc = 'reference.inserts.create_device'
        select_proc = 'reference.selects.get_devices'

        return self._process_names(
            insert_proc, select_proc,
            self.device_where_in_list,
            self.device_placeholders,
            self.unique_devices
        )

    def process_machines(self):
        """
        Process the machine reference data
        """

        if not self.machine_name_placeholders:
            return {}

        # Convert WHERE filters to string
        where_in_clause = ",".join(self.machine_where_in_list)

        select_proc = 'reference.selects.get_machines'
        insert_proc = 'reference.inserts.create_machine'
        update_proc = 'reference.updates.update_machine_timestamp'

        self.execute(
            proc=insert_proc,
            placeholders=self.machine_name_placeholders,
            executemany=True,
            debug_show=self.DEBUG)

        name_lookup = self.execute(
            proc=select_proc,
            placeholders=self.machine_unique_names,
            replace=[where_in_clause],
            key_column='name',
            return_type='dict',
            debug_show=self.DEBUG)

        """
        There is a bug in the python mysqldb module that is triggered by the
        use of an INSERT/SELECT/ON DUPLICATE KEY query with the executemany
        option that results in

        'TypeError: not all arguments converted during string formatting'

        To circumvent this we do an explicit update to set the
        last_timestamp. In parallel job execution this could lead to a
        race condition where the machine timestamp is set by another
        job processor but the intention of last_timestamp is to keep an
        approximate time associated with the machine's last report so this
        should not be a problem.

        NOTE: There was a possibility of a data integrity issue caused by the
            ON DUPLICATE KEY UPDATE strategy. When the ON DUPLICATE KEY clause
            is executed the auto increment id will be incremented. This has
            the potential to mangle previous stored machine_ids. This would
            be bad...
        """
        self.execute(
            proc=update_proc,
            placeholders=self.machine_timestamp_update_placeholders,
            executemany=True,
            debug_show=self.DEBUG)

        return name_lookup

    def process_option_collections(self):
        """
        Process option collection data
        """

        # Store options not seen yet
        o_where_in_clause = ",".join(self.o_where_in_list)
        option_id_lookup = self._get_or_create_options(
            self.o_placeholders, self.o_unique_options, o_where_in_clause
        )

        # Get the list of option collection placeholders
        for oc_hash in self.oc_hash_lookup:
            for o in self.oc_hash_lookup[oc_hash]:
                self.oc_placeholders.append([
                    oc_hash, option_id_lookup[o]['id'], oc_hash,
                    option_id_lookup[o]['id']
                ])

        if not self.oc_placeholders:
            return {}

        self.execute(
            proc='reference.inserts.create_option_collection',
            placeholders=self.oc_placeholders,
            executemany=True,
            debug_show=self.DEBUG)

        return self.oc_hash_lookup

    def _process_platforms(
            self, insert_proc, select_proc, platform_lookup,
            platform_placeholders, unique_platforms, where_filters):
        """
        Internal method for processing either build or machine platforms.
        The caller is required to provide the appropriate data structures
        depending on what type of platform is being processed.
        """

        if where_filters:

            self.execute(
                proc=insert_proc,
                placeholders=platform_placeholders,
                executemany=True,
                debug_show=self.DEBUG)

            # Convert WHERE filters to string
            where_in_clause = " OR ".join(where_filters)

            # NOTE: This query is using master_host to insure we don't have a
            # race condition with INSERT into master and SELECT new ids from
            # the slave.
            data_retrieved = self.execute(
                proc=select_proc,
                placeholders=unique_platforms,
                replace=[where_in_clause],
                debug_show=self.DEBUG)

            for data in data_retrieved:

                key = RefDataManager.get_platform_key(
                    data['os_name'], data['platform'], data['architecture']
                )

                platform_lookup[key]['id'] = int(data['id'])

        return platform_lookup

    def _process_names(
            self, insert_proc, select_proc, where_in_list, name_placeholders,
            unique_names):
        """
        Internal method for processing reference data names. The caller is
        required to provide the appropriate data structures for the target
        reference data type.
        """

        if not name_placeholders:
            return {}

        # Convert WHERE filters to string
        where_in_clause = ",".join(where_in_list)

        self.execute(
            proc=insert_proc,
            placeholders=name_placeholders,
            executemany=True,
            debug_show=self.DEBUG)

        name_lookup = self.execute(
            proc=select_proc,
            placeholders=unique_names,
            replace=[where_in_clause],
            key_column='name',
            return_type='dict',
            debug_show=self.DEBUG)

        return name_lookup

    def _process_names_and_symbols(
            self, insert_proc, select_proc, name_symbol_lookup,
            name_symbol_placeholders, names_and_symbols, where_filters):
        """
        Internal method for processing reference data names and their associated
        symbols. The caller is required to provide the appropriate data
        structures for the target reference data type.
        """
        if where_filters:

            self.execute(
                proc=insert_proc,
                placeholders=name_symbol_placeholders,
                executemany=True,
                debug_show=self.DEBUG)

            # Convert WHERE filters to string
            where_in_clause = " OR ".join(where_filters)

            data_retrieved = self.execute(
                proc=select_proc,
                placeholders=names_and_symbols,
                replace=[where_in_clause],
                debug_show=self.DEBUG)

            for data in data_retrieved:

                key = RefDataManager.get_name_symbol_key(
                    data['name'], data['symbol']
                )

                name_symbol_lookup[key] = data
                name_symbol_lookup[key]['id'] = int(data['id'])

        return name_symbol_lookup

    def get_or_create_build_platforms(self, platform_data):
        """
        Get or create build platforms for a list of platform data.
        See _get_or_create_platforms for data structure descriptions.
        """

        insert_proc = 'reference.inserts.create_build_platform'
        select_proc = 'reference.selects.get_build_platforms'

        return self._get_or_create_platforms(
            platform_data, insert_proc, select_proc,
            self.build_platform_lookup,
            self.build_platform_placeholders,
            self.build_unique_platforms,
            self.build_where_filters
        )

    def get_or_create_machine_platforms(self, platform_data):
        """
        Get or create machine platforms for a list of platform data.
        See _get_or_create_platforms for data structure descriptions.
        """

        insert_proc = 'reference.inserts.create_machine_platform'
        select_proc = 'reference.selects.get_machine_platforms'

        return self._get_or_create_platforms(
            platform_data, insert_proc, select_proc,
            self.machine_platform_lookup,
            self.machine_platform_placeholders,
            self.machine_unique_platforms,
            self.machine_where_filters
        )

    def _get_or_create_platforms(
            self, platform_data, insert_proc, select_proc,
            platform_lookup, platform_placeholders, unique_platforms,
            where_filters):
        """
        Takes a list of lists of os_name, platform, and architecture
        columns and returns a dictionary to be used as a lookup for each
        combination's associated id. Any platforms not found are created,
        duplicate platforms are aggregated to minimize database operations.

        platform_data =
            [
                [os_name, platform, architecture],
                [os_name, platform, architecture],
                ...
                ]

        returns {
            "os_name-platform-architecture": {
                id:id, os_name:os_name,
                platform:platform,
                architecture:architecture
                },
            "os_name-platform-architecture": {
                id:id,
                os_name:os_name,
                platform:platform,
                architecture:architecture
                },
            ...
            }
        """
        for item in platform_data:

            self._add_platform(
                # os_name, platform, architecture
                item[0], item[1], item[2],
                platform_lookup, platform_placeholders,
                unique_platforms, where_filters
            )

        return self._process_platforms(
            insert_proc, select_proc,
            platform_lookup,
            platform_placeholders,
            unique_platforms,
            where_filters
        )

    @classmethod
    def get_platform_key(cls, os_name, platform, architecture):
        return "{0}-{1}-{2}".format(os_name, platform, architecture)

    @classmethod
    def get_name_symbol_key(cls, name, symbol):
        return "{0}-{1}".format(name, symbol)

    def get_or_create_job_groups(self, names):
        """
        Get or create job groups given a list of job group names.
        See _get_or_create_names for data structure descriptions.
        """

        insert_proc = 'reference.inserts.create_job_group'
        select_proc = 'reference.selects.get_job_groups'

        return self._get_or_create_names_and_symbols(
            names, insert_proc, select_proc,
            self.job_group_names_and_symbols,
            self.job_group_placeholders,
            self.job_group_lookup,
            self.job_group_where_filters)

    def get_or_create_job_types(self, names):
        """
        Get or create job types given a list of job type names.
        See _get_or_create_names for data structure descriptions.
        """

        insert_proc = 'reference.inserts.create_job_type'
        select_proc = 'reference.selects.get_job_types'

        return self._get_or_create_names_and_symbols(
            names, insert_proc, select_proc,
            self.job_type_names_and_symbols,
            self.job_type_placeholders,
            self.job_type_lookup,
            self.job_type_where_filters)

    def get_or_create_products(self, names):
        """
        Get or create products given a list of product names.  See
        _get_or_create_names for data structure descriptions.
        """

        insert_proc = 'reference.inserts.create_product'
        select_proc = 'reference.selects.get_products'

        return self._get_or_create_names(
            names, insert_proc, select_proc,
            self.product_lookup, self.product_placeholders,
            self.unique_products, self.product_where_in_list)

    def get_or_create_devices(self, names):
        """
        Get or create devices given a list of device names.  See
        _get_or_create_names for data structure descriptions.
        """

        insert_proc = 'reference.inserts.create_device'
        select_proc = 'reference.selects.get_devices'

        return self._get_or_create_names(
            names, insert_proc, select_proc,
            self.device_lookup, self.device_placeholders,
            self.unique_devices, self.device_where_in_list)

    def get_or_create_machines(self, names_and_timestamps):
        """
        Takes a list of machine names and timestamps returns a dictionary to
        be used as a lookup for each machine name's id. Any names not found
        are inserted into the appropriate table, duplicate machine names are
        aggregated to minimize database operations.

        names = [
            [ machine1, time1 ],
            [ machine2, time2 ],
            [ machine3, time3 ],
            ... ]

        returns {
            'machine1':{'id':id, 'name':name },
            'machine1':{'id':id, 'name':name },
            'machine1':{'id':id, 'name':name },
            ...
            }
        """
        for item in names_and_timestamps:
            # machine name, timestamp
            self.add_machine(item[0], item[1])

        return self.process_machines()

    def _get_or_create_names(self,
                             names, insert_proc, select_proc,
                             name_lookup, where_in_list, name_placeholders, unique_names):
        """
        Takes a list of names and returns a dictionary to be used as a
        lookup for each name's id. Any names not found are inserted into
        the appropriate table, duplicate platforms are aggregated to
        minimize database operations.

        names = [ name1, name2, name3 ... ]

        returns { 'name1':id, 'name2':id, 'name3':id, ... }
        """
        for name in names:
            self._add_name(
                name, name_lookup, name_placeholders,
                unique_names, where_in_list
            )

        return self._process_names(
            insert_proc, select_proc, where_in_list, name_placeholders,
            unique_names
        )

    def _get_or_create_names_and_symbols(
            self, data, insert_proc, select_proc, names_and_symbols, placeholders,
            name_symbol_lookup, where_filters):
        """
        Takes a list of names and returns a dictionary to be used as a
        lookup for each name's id. Any names not found are inserted into
        the appropriate table, duplicate platforms are aggregated to
        minimize database operations.

        names = [
            [name1, symbol1],
            [name2, symbol2],
            [name3, symbol3],
             ...
            ]

        returns { 'name1':id, 'name2':id, 'name3':id, ... }
        """
        for name_symbol in data:
            self._add_name_and_symbol(
                name_symbol[0], name_symbol[1], names_and_symbols,
                placeholders, name_symbol_lookup, where_filters
            )

        return self._process_names_and_symbols(
            insert_proc, select_proc, name_symbol_lookup, placeholders,
            names_and_symbols, where_filters
        )

    def get_option_collection_hash(self, options):
        """returns an option_collection_hash given a list of options"""

        options = sorted(list(options))
        sha_hash = sha1()
        # equivalent to loop over the options and call sha_hash.update()
        sha_hash.update(''.join(options))
        return sha_hash.hexdigest()

    def get_or_create_option_collection(self, option_collections):
        """
        Get or create option collections for each list of options provided.

        [
            [ option1, option2, option3 ],
            ...
        ]
        """

        # Build set of unique options
        for option_set in option_collections:

            self.add_option_collection(option_set)

        return self.process_option_collections()

    def _get_or_create_options(
            self, option_placeholders, unique_options, where_in_clause):

        if not option_placeholders:
            return {}

        insert_proc = 'reference.inserts.create_option'
        select_proc = 'reference.selects.get_options'

        self.execute(
            proc=insert_proc,
            placeholders=option_placeholders,
            executemany=True,
            debug_show=self.DEBUG)

        option_lookup = self.execute(
            proc=select_proc,
            placeholders=unique_options,
            replace=[where_in_clause],
            key_column='name',
            return_type='dict',
            debug_show=self.DEBUG)

        return option_lookup

    def get_db_name(self):
        """The name of the database holding the refdata tables"""
        return self.dhub.conf["default_db"]

    def get_all_option_collections(self):
        """
        Returns all option collections in the following data structure

        {
            "hash1":{
                option_collection_hash : "hash1",
                opt:"opt1 opt2"
                },
            "hash2":{
                option_collection_hash : "hash2",
                opt:"opt3 opt4 opt5"
                }
            ...
            }
        """
        return self.execute(
            proc='reference.selects.get_all_option_collections',
            debug_show=self.DEBUG,
            key_column='option_collection_hash',
            return_type='dict'
        )

    def get_repository_id(self, name):
        """get the id for the given repository"""
        id_iter = self.execute(
            proc='reference.selects.get_repository_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_repository_info(self, repository_id):
        """retrieves all the attributes of a repository"""

        repo = self.execute(
            proc='reference.selects.get_repository_info',
            placeholders=[repository_id],
            debug_show=self.DEBUG,
            return_type='iter')
        # retrieve the first elem from DataIterator
        for r in repo:
            return r

    def get_all_repository_info(self):
        return self.execute(
            proc='reference.selects.get_all_repository_info',
            debug_show=self.DEBUG,
            return_type='iter')

    def get_bug_numbers_list(self):
        return self.execute(
            proc='reference.selects.get_all_bug_numbers',
            debug_show=self.DEBUG,
            return_type='iter')

    def delete_bugs(self, bug_ids):
        """delete a list of bugs given the ids"""

        self.execute(
            proc='reference.deletes.delete_bugs',
            debug_show=self.DEBUG,
            replace=[",".join(["%s"] * len(bug_ids))],
            placeholders=list(bug_ids))

    def update_bugscache(self, bug_list):
        """
        Add content to the bugscache, updating/deleting/inserting
        when necessary.
        """
        bugs_stored = set(bug["id"] for bug in self.get_bug_numbers_list())
        old_bugs = bugs_stored.difference(set(bug['id']
                                              for bug in bug_list))
        if old_bugs:
            self.delete_bugs(old_bugs)

        placeholders = []
        for bug in bug_list:
            # keywords come as a list of values, we need a string instead
            bug['keywords'] = ",".join(bug['keywords'])
            placeholders.append([bug.get(field, None) for field in (
                'id', 'status', 'resolution', 'summary',
                'cf_crash_signature', 'keywords', 'op_sys', 'last_change_time', 'id')])

        self.execute(
            proc='reference.inserts.create_bugscache',
            placeholders=placeholders,
            executemany=True,
            debug_show=self.DEBUG)

        # removing the first placeholder because is not used in the update query
        del placeholders[0]

        self.execute(
            proc='reference.updates.update_bugscache',
            placeholders=placeholders,
            executemany=True,
            debug_show=self.DEBUG)

    def get_bug_suggestions(self, search_term):
        """
        Retrieves two groups of bugs:
        1) "Open recent bugs" (ie bug is not resolved & was modified in last 3 months)
        2) "All other bugs" (ie all closed bugs + open bugs that were not modified in the last 3 months).
        """

        max_size = 50
        # 90 days ago
        time_limit = datetime.now() - timedelta(days=90)
        # Wrap search term so it is used as a phrase in the full-text search.
        search_term_fulltext = search_term.join('""')
        # Substitute escape and wildcard characters, so the search term is used
        # literally in the LIKE statement.
        search_term_like = search_term.replace('=', '==').replace('%', '=%').replace('_', '=_')

        open_recent = self.execute(
            proc='reference.selects.get_open_recent_bugs',
            placeholders=[search_term_fulltext, search_term_like, time_limit, max_size + 1],
            debug_show=self.DEBUG)

        all_others = self.execute(
            proc='reference.selects.get_all_others_bugs',
            placeholders=[search_term_fulltext, search_term_like, time_limit, max_size + 1],
            debug_show=self.DEBUG)

        return dict(open_recent=open_recent, all_others=all_others)

    def get_reference_data_signature(self, signature_properties):

        sh = sha1()
        sh.update(''.join(map(lambda x: str(x), signature_properties)))

        return sh.hexdigest()

    def get_reference_data_signature_names(self, signatures):

        reference_data = {}

        if signatures:

            reference_data_signatures_where_in_clause = [
                ','.join(['%s'] * len(signatures))
            ]

            reference_data = self.execute(
                proc="reference.selects.get_reference_data_signature_names",
                placeholders=signatures,
                replace=reference_data_signatures_where_in_clause,
                debug_show=self.DEBUG,
                key_column='signature',
                return_type='dict')

        return reference_data

    def get_reference_data(self, signatures):
        # use job_id to map to reference data
        reference_data = {}

        if signatures:

            reference_data_signatures_where_in_clause = [','.join(['%s'] * len(signatures))]

            reference_data = self.execute(
                proc="reference.selects.get_reference_data",
                placeholders=signatures,
                replace=reference_data_signatures_where_in_clause,
                debug_show=self.DEBUG,
                key_column='signature',
                return_type='dict')

        return reference_data
