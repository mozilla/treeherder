import logging
import os

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
            "passwd": settings.DATABASES['default'].get('PASSWORD') or '',
        }
        if 'OPTIONS' in settings.DATABASES['default']:
            master_host_config.update(settings.DATABASES['default']['OPTIONS'])

        read_host_config = {
            "host": settings.DATABASES['read_only']['HOST'],
            "user": settings.DATABASES['read_only']['USER'],
            "passwd": settings.DATABASES['read_only'].get('PASSWORD') or '',
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
        self.build_signature_placeholders = []

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
