import logging
from typing import List

from django.conf import settings
from django.db import transaction
from taskcluster.exceptions import TaskclusterRestFailure

from treeherder.perf.models import PerformanceSignature
from treeherder.services.taskcluster import TaskclusterModel
from .max_runtime import MaxRuntime
from .email_service import EmailService

logger = logging.getLogger(__name__)

RECEIVER_TEAM_EMAIL = "perftest-alerts@mozilla.com"


class PublicSignatureRemover:
    """
    This class handles the removal of signatures which are (no longer)
    associated to any data point and sends email notifications to the entire team.
    """

    def __init__(
        self,
        timer: MaxRuntime,
        taskcluster_model: TaskclusterModel,
        max_rows_allowed=None,
        max_emails_allowed=None,
    ):
        self.tc_model = taskcluster_model
        self._max_rows_allowed = max_rows_allowed or 50
        self._max_emails_allowed = max_emails_allowed or 10

        self.email_service = EmailService(address=RECEIVER_TEAM_EMAIL)
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
                self.email_service.content = perf_signature

                if rows_left == 0:
                    success = self.__delete_and_notify(chunk_of_signatures)
                    if not success:
                        break

                    emails_sent += 1
                    chunk_of_signatures = []
                    self.email_service.content = None
                    rows_left = self._max_rows_allowed

        if emails_sent < self._max_emails_allowed and chunk_of_signatures != []:
            self.__delete_and_notify(chunk_of_signatures)

    def _send_notification(self):
        # should only run on one instance at a time
        if settings.NOTIFY_CLIENT_ID and settings.NOTIFY_ACCESS_TOKEN:
            logger.info("Sending email with summary of deleted perf signatures to team...")
            self._send_email()
        else:
            logger.warning("Failed to send notification because deployment is NOT production")

    @staticmethod
    def _delete(chunk_of_signatures):
        for signature in chunk_of_signatures:
            signature.delete()

    def _send_email(self):
        self.tc_model.notify.email(self.email_service.payload)

    def __delete_and_notify(self, signatures: List[PerformanceSignature]) -> bool:
        """
        Atomically deletes perf signatures & notifies about this.
        @return: whether atomic operation was successful or not
        """

        try:
            with transaction.atomic():
                self._delete(signatures)
                self._send_notification()
        except TaskclusterRestFailure as ex:
            logger.warning(
                f'Failed to atomically delete perf signatures & notify about this. (Reason: {ex})'
            )
            return False

        return True
