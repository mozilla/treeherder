import os
from hashlib import sha1
from django.conf import settings
from datasource.bases.BaseHub import BaseHub
from datasource.DataHub import DataHub
from .base import TreeherderModelBase


class RefDataManager(object):
    """Model for reference data"""

    def __init__(self):
        procs_path = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                                  'sql', 'reference.json')
        data_source = {
            'reference': {
                "hub": "MySQL",
                "master_host": {
                    "host": settings.DATABASES['default']['HOST'],
                    "user": settings.DATABASES['default']['USER'],
                    "passwd": settings.DATABASES['default']['PASSWORD']
                },
                "default_db": settings.DATABASES['default']['NAME'],
                "procs": [procs_path]
            }
        }
        BaseHub.add_data_source(data_source)
        self.dhub = DataHub.get("reference")
        self.DEBUG = settings.DEBUG

    def get_build_platform_id(self, os_name, platform, architecture):

        id_iter = self.dhub.execute(
            proc='reference.selects.get_build_platform_id',
            placeholders=[os_name, platform, architecture],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_build_platform(self, os_name, platform, architecture):

        self.dhub.execute(
            proc='reference.inserts.create_build_platform',
            placeholders=[
                os_name,
                platform,
                architecture,
                os_name,
                platform,
                architecture,
            ],
            debug_show=self.DEBUG)

        return self.get_build_platform_id(
            os_name,
            platform,
            architecture)

    def get_job_group_id(self, name):

        id_iter = self.dhub.execute(
            proc='reference.selects.get_job_group_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_job_group(self, name):

        self.dhub.execute(
            proc='reference.inserts.create_job_group',
            placeholders=[
                name,
                name
            ],
            debug_show=self.DEBUG)

        return self.get_job_group_id(name)

    def get_job_type_id(self, name, group):

        id_iter = self.dhub.execute(
            proc='reference.selects.get_job_type_id',
            placeholders=[name, group],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_job_type(self, name, group):

        group_id = self.get_or_create_job_group(group)

        self.dhub.execute(
            proc='reference.inserts.create_job_type',
            placeholders=[
                group_id,
                name,
                group_id,
                name
            ],
            debug_show=self.DEBUG)

        return self.get_job_type_id(name, group)

    def get_machine_id(self, name):

        id_iter = self.dhub.execute(
            proc='reference.selects.get_machine_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_machine(self, name, timestamp):
        self.dhub.execute(
            proc='reference.inserts.create_machine',
            placeholders=[
                name,
                timestamp,
                timestamp,
                name
            ],
            debug_show=self.DEBUG)

        return self.get_machine_id(name)

    def get_machine_platform_id(self, os_name, platform, architecture):

        id_iter = self.dhub.execute(
            proc='reference.selects.get_machine_platform_id',
            placeholders=[os_name, platform, architecture],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_machine_platform(self, os_name, platform,
                                       architecture):

        self.dhub.execute(
            proc='reference.inserts.create_machine_platform',
            placeholders=[
                os_name,
                platform,
                architecture,
                os_name,
                platform,
                architecture,
            ],
            debug_show=self.DEBUG)

        return self.get_machine_platform_id(
            os_name,
            platform,
            architecture)

    def get_option_id(self, name):

        id_iter = self.dhub.execute(
            proc='reference.selects.get_option_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_option(self, name):

        self.dhub.execute(
            proc='reference.inserts.create_option',
            placeholders=[
                name,
                name
            ],
            debug_show=self.DEBUG)

        return self.get_option_id(name)

    def get_option_collection_hash(self, options):
        """returns an option_collection_hash given a list of options"""

        options = sorted(list(options))
        sha_hash = sha1()
        # equivalent to loop over the options and call sha_hash.update()
        sha_hash.update(''.join(options))
        return sha_hash.hexdigest()

    def get_or_create_option_collection(self, options):

        #check if this collection already exists
        option_collection_hash = self.get_option_collection_hash(options)
        print len(option_collection_hash)
        for option in options:

            #create an option if it doesn't exist
            option_id = self.get_or_create_option(option)

            # create an entry in option_collection
            self.dhub.execute(
                proc='reference.inserts.create_option_collection',
                placeholders=[
                    option_collection_hash,
                    option_id,
                    option_collection_hash,
                    option_id
                ],
                debug_show=self.DEBUG)
        return option_collection_hash

    def get_product_id(self, name):

        id_iter = self.dhub.execute(
            proc='reference.selects.get_product_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_product(self, name):

        self.dhub.execute(
            proc='reference.inserts.create_product',
            placeholders=[
                name,
                name
            ],
            debug_show=self.DEBUG)

        return self.get_product_id(name)

    def get_repository_version(self, repository_id, version):

        id_iter = self.dhub.execute(
            proc='reference.selects.get_repository_version_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_repository_version(self, repository_id, version,
                                         version_timestamp):

        self.dhub.execute(
            proc='reference.inserts.create_repository_version',
            placeholders=[
                repository_id,
                version,
                version_timestamp,
                repository_id,
                version
            ],
            debug_show=self.DEBUG)

        return self.get_repository_version(repository_id, version)
