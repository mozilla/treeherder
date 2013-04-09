from .base import TreeherderModelBase


class RefDataModel(TreeherderModelBase):
    """Model for reference data"""

    CONTENT_TYPES = ['jobs']

    def get_or_create_build_platform(os_name, platform, architecture,
                                     defaults=None):
        """create a new build_platform if not present"""

        self.sources["jobs"].dhub.execute(
            proc='reference.inserts.set_product_ref_data',
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

        # Get the build_platform id
        id_iter = self.sources["jobs"].dhub.execute(
            proc='perftest.selects.get_build_platform_id',
            placeholders=[os_name, platform, architecture],
            debug_show=self.DEBUG,
            return_type='iter'
        )

        return id_iter.get_column_data('id')

    def get_or_create_job_type():
        pass

    def get_or_create_machine():
        pass

    def get_or_create_machine_platform():
        pass

    def get_or_create_option():
        pass

    def get_or_create_option_collection():
        pass

    def get_or_create_product():
        pass

    def get_or_create_repository_version():
        pass
