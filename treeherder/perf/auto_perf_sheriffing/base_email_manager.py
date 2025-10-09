from treeherder.services import taskcluster


class EmailManager:
    """Formats and emails alert notifications."""

    def __init__(self):
        self.notify_client = taskcluster.notify_client_factory()

    def get_email_func(self):
        return self.notify_client.email

    def email_alert(self, *args, **kwargs):
        pass
