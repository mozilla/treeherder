from base import *

# ------------------------------------------------------------------------------
# Generic base class for messages that have to do with builds
# ------------------------------------------------------------------------------

# TODO: This isn't generic
class BuildMessage(GenericMessage):
    def __init__(self, event):
        super(BuildMessage, self).__init__()
        self.routing_parts.append(event['event'])
        self.metadata['master_name'] = event['master_name']
        self.metadata['master_incarnation'] = event['master_incarnation']
        self.metadata['message_id'] = event['id']

        for key, value in event['payload'].items():
            self.set_data(key, value)

# ------------------------------------------------------------------------------
# Base class for messages that have to do with posting builds to ftp
# ------------------------------------------------------------------------------

class BuildPostedMessage(GenericMessage):
    def __init__(self):
        super(BuildPostedMessage, self).__init__()
        self.routing_parts.append('build')
        self.routing_parts.append('posted')

    def _required_data_fields(self):
        tmp = super(BuildPostedMessage, self)._required_data_fields()
        tmp.append('build_id')
        tmp.append('revision')
        tmp.append('url')
        tmp.append('repository')
        tmp.append('product')
        tmp.append('product_version')
        tmp.append('locale')
        tmp.append('platform')
        tmp.append('build_date')
        tmp.append('package_type')
        return tmp

# ------------------------------------------------------------------------------
# Builds that are posted and meant to be downloaded and applied manually
# ------------------------------------------------------------------------------

class ManualBuildPostedMessage(BuildPostedMessage):
    def __init__(self):
        super(ManualBuildPostedMessage, self).__init__()
        self.routing_parts.append('manual')

# ------------------------------------------------------------------------------
# Builds that are posted and meant to be downloaded and applied as updates
# ------------------------------------------------------------------------------

class UpdateBuildPostedMessage(BuildPostedMessage):
    def __init__(self):
        super(UpdateBuildPostedMessage, self).__init__()
        self.routing_parts.append('update')

# ------------------------------------------------------------------------------
# Partial updates that are posted to ftp
# ------------------------------------------------------------------------------

class PartialUpdateBuildPostedMessage(UpdateBuildPostedMessage):
    def __init__(self):
        super(PartialUpdateBuildPostedMessage, self).__init__()
        self.routing_parts.append('partial')

    def _required_data_fields(self):
        tmp = super(PartialUpdateBuildPostedMessage, self)._required_data_fields()
        tmp.append('for_build')
        return tmp

# ------------------------------------------------------------------------------
# Full updates that are posted to ftp
# ------------------------------------------------------------------------------

class FullUpdateBuildPostedMessage(UpdateBuildPostedMessage):
    def __init__(self):
        super(FullUpdateBuildPostedMessage, self).__init__()
        self.routing_parts.append('full')
