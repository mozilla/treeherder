import logging
import os
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
