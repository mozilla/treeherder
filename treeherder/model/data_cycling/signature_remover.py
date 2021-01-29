import logging
from typing import List

from django.conf import settings
from django.db import transaction
from taskcluster.exceptions import TaskclusterRestFailure

from treeherder.perf.models import PerformanceSignature
from treeherder.services.taskcluster import TaskclusterModel
from .max_runtime import MaxRuntime

logger = logging.getLogger(__name__)

RECEIVER_TEAM_EMAIL = "perftest-alerts@mozilla.com"


class PublicSignatureRemover:
    """
    This class handles the removal of signatures which are (no longer)
    associated to any data point and sends email notifications to the entire team.
    """

    TABLE_DESCRIPTION = """Perfherder removes performance data that is older than one year and in some cases even sooner, leaving behind performance signatures that aren't associated to any data point. These as well need to be removed.
> __Here's a summary of recently deleted performance signatures:__
---
    """

    TABLE_HEADERS = """
| Repository | Framework | Platform | Suite | Application |
| :---: | :---: | :---: | :---: | :---: |
    """

    def __init__(
        self,
        timer: MaxRuntime,
        taskcluster_model: TaskclusterModel,
        max_rows_allowed=None,
        max_emails_allowed=None,
    ):
        self.tc_model = taskcluster_model
        self._subject = "Summary of deleted Performance Signatures"
        self._content = None
        self._max_rows_allowed = max_rows_allowed or 50
        self._max_emails_allowed = max_emails_allowed or 10

        self.timer = timer

    def remove_in_chunks(self, signatures):
        emails_sent = 0
        rows_left = self._max_rows_allowed
        chunk_of_signatures = []

        logger.warning("Removing performance signatures which don't have any data points...")
        for perf_signature in signatures:
            self.timer.quit_on_timeout()

            if emails_sent < self._max_emails_allowed and (
                not perf_signature.has_performance_data()
            ):
                rows_left -= 1
                chunk_of_signatures.append(perf_signature)

                if rows_left == 0:
                    success = self.__delete_and_notify(chunk_of_signatures)
                    if not success:
                        break

                    emails_sent += 1
                    chunk_of_signatures = []
                    rows_left = self._max_rows_allowed

        if emails_sent < self._max_emails_allowed and chunk_of_signatures != []:
            self.__delete_and_notify(chunk_of_signatures)

    def _send_notification(self, email_data):
        # should only run on one instance at a time
        if settings.NOTIFY_CLIENT_ID and settings.NOTIFY_ACCESS_TOKEN:
            logger.info("Sending email with summary of deleted perf signatures to team...")
            self._send_email(RECEIVER_TEAM_EMAIL, email_data)
        else:
            logger.warning("Failed to send notification because deployment is NOT production")

    def _ping_notify_service(self):
        # should only run on one instance at a time
        if settings.NOTIFY_CLIENT_ID and settings.NOTIFY_ACCESS_TOKEN:
            self.tc_model.notify.ping()
        else:
            logger.warning("Failed to ping Notify service because deployment is NOT production")

    @staticmethod
    def _delete(chunk_of_signatures):
        for signature in chunk_of_signatures:
            signature.delete()

    def _send_email(self, address: str, signatures: List[dict]):
        self.__set_content(signatures)
        payload = {
            "address": address,
            "content": self._content,
            "subject": self._subject,
        }
        self.tc_model.notify.email(payload)

    def __set_content(self, signatures: List[dict]):
        self._content = self.TABLE_DESCRIPTION + self.TABLE_HEADERS
        for signature in signatures:
            self.__add_new_row(signature)

    def __add_new_row(self, signature: dict):
        signature_row = (
            """| {repository} | {framework} | {platform} | {suite} | {application} |""".format(
                repository=signature["repository"],
                framework=signature["framework"],
                platform=signature["platform"],
                suite=signature["suite"],
                application=signature["application"],
            )
        )
        self._content += signature_row
        self._content += "\n"

    @staticmethod
    def __extract_properties(signatures) -> List[dict]:
        properties = []
        for signature in signatures:
            signature_properties = {
                "repository": signature.repository,
                "framework": signature.framework,
                "platform": signature.platform,
                "suite": signature.suite,
                "application": signature.application,
            }
            properties.append(signature_properties)
        return properties

    def __delete_and_notify(self, signatures: List[PerformanceSignature]) -> bool:
        """
        Atomically deletes perf signatures & notifies about this.
        @return: whether atomic operation was successful or not
        """
        email_data = self.__extract_properties(signatures)  # so we don't lose them during deletion

        try:
            with transaction.atomic():
                self._delete(signatures)
                self._send_notification(email_data)
        except TaskclusterRestFailure as ex:
            logger.warning(
                f'Failed to atomically delete perf signatures & notify about this. (Reason: {ex})'
            )
            return False

        return True
