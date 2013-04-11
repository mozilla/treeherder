from .base import TreeherderModelBase


class RefDataManager(TreeherderModelBase):
    """Model for reference data"""

    CONTENT_TYPES = ['jobs']

    # TODO: discuss about dynamic methods generation
    # def _get_generic(self, keys, proc):

    #     id_iter = self.sources["jobs"].dhub.execute(
    #         proc=proc,
    #         placeholders=keys,
    #         debug_show=self.DEBUG,
    #         return_type='iter')

    #     return id_iter.get_column_data('id')

    # def _get_or_create_generic(self, keys, others, proc):

    #     self.sources["jobs"].dhub.execute(
    #         proc=proc,
    #         placeholders=keys+others+keys,
    #         debug_show=self.DEBUG)
    #     return self._get_generic_id(keys, proc)

    def get_build_platform_id(self, os_name, platform, architecture):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_build_platform_id',
            placeholders=[os_name, platform, architecture],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_build_platform(self, os_name, platform, architecture,
                                     active_status):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_build_platform',
            placeholders=[
                os_name,
                platform,
                architecture,
                active_status,
                os_name,
                platform,
                architecture,
            ],
            debug_show=self.DEBUG)

        return self.get_build_platform_id(
            os_name,
            platform,
            architecture)

    def get_job_type_id(self, job_group_id, symbol, name):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_job_type_id',
            placeholders=[job_group_id, symbol, name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_job_type(self, job_group_id, symbol, name,
                               description, active_status):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_job_type',
            placeholders=[
                job_group_id,
                symbol,
                name,
                description,
                active_status,
                job_group_id,
                symbol,
                name,
            ],
            debug_show=self.DEBUG)

        return self.get_job_type_id(job_group_id, symbol, name)

    def get_machine_id(self, name):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_machine_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_machine(self, name, ):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_machine',
            placeholders=[
                name,
                first_timestamp,
                last_timestamp,
                active_status,
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
                                       architecture, active_status):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_machine_platform',
            placeholders=[
                os_name,
                platform,
                architecture,
                active_status,
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

    def get_or_create_option(self, name, description, active_status):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_option',
            placeholders=[
                name,
                description,
                active_status,
                name
            ],
            debug_show=self.DEBUG)

        return self.get_option_id(name)

    def get_option_collection_id(self, option_collection_id, option_id):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_option_collection_id',
            placeholders=[option_collection_id, option_id],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_option_collection(self, option_collection_id,
                                        option_id):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_option_collection',
            placeholders=[
                option_collection_id,
                option_id,
                option_collection_id,
                option_id
            ],
            debug_show=self.DEBUG)

        return self.get_option_collection_id(
            option_collection_id,
            option_id)

    def get_product_id(self, name):

        id_iter = self.sources["jobs"].dhub.execute(
            proc='reference.selects.get_product_id',
            placeholders=[name],
            debug_show=self.DEBUG,
            return_type='iter')

        return id_iter.get_column_data('id')

    def get_or_create_product(self, name, description, active_status):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_product',
            placeholders=[
                name,
                description,
                active_status,
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
                                         version_timestamp, active_status):

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.create_repository_version',
            placeholders=[
                repository_id,
                version,
                version_timestamp,
                active_status,
                repository_id,
                version
            ],
            debug_show=self.DEBUG)

        return self.get_repository_version(repository_id, version)
