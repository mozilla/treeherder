from .base import TreeherderModelBase


class RefDataManager(TreeherderModelBase):
    """Model for reference data"""

    CONTENT_TYPES = ['jobs']

    def get_build_platform_id(self, os_name, platform, architecture):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_build_platform_id',
            placeholders=[os_name, platform, architecture],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_build_platform(self, os_name, platform, architecture):

        self.sources["jobs"].dhub.execute(
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

    def get_job_type_id(self, name):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_job_type_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_machine_id(self, name):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_machine_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_machine(self, name, timestamp):
        self.sources["jobs"].dhub.execute(
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

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_machine_platform_id',
            placeholders=[os_name, platform, architecture],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_machine_platform(self, os_name, platform,
                                       architecture):

        self.sources["jobs"].dhub.execute(
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

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_option_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_option(self, name, description):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_option',
            placeholders=[
                name,
                description,
                name
            ],
            debug_show=self.DEBUG)

        return self.get_option_id(name)

    def get_option_collection_id(self, options):
        """returns an option_collection_id given a list of options"""
        options = sorted(list(options))

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_option_collection_id',
            placeholders=[','.join(options)],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_last_collection_id(self):
        self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_last_collection_id',
            placeholders=[],
            debug_show=self.DEBUG)

    def get_or_create_option_collection(self, options):

        #check if this collection already exists
        id = self.get_option_collection_id(options)
        if not id:

            #retrieve the last collection
            option_collection_id = self.get_last_collection_id() + 1
            for option in options:

                #create an option if it doesn't exist
                option_id = self.get_or_create_option(option,
                                                      'description needed')

                # create an entry in option_collection
                self.sources["jobs"].dhub.execute(
                    proc='reference.inserts.create_option_collection',
                    placeholders=[
                        option_collection_id,
                        option_id,
                        option_collection_id,
                        option_id
                    ],
                    debug_show=self.DEBUG)
            id = self.get_option_collection_id(options)
        return id

    def get_product_id(self, name):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_product_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_product(self, name, description):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_product',
            placeholders=[
                name,
                description,
                name
            ],
            debug_show=self.DEBUG)

        return self.get_product_id(name)

    def get_repository_version(self, repository_id, version):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_repository_version_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_repository_version(self, repository_id, version,
                                         version_timestamp):

        self.sources["jobs"].dhub.execute(
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
