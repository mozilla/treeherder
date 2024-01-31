import logging
from typing import List

import taskcluster
from django.conf import settings
from django.db import transaction
from django.db.models import QuerySet
from taskcluster.exceptions import TaskclusterRestFailure

from treeherder.perf.models import PerformanceSignature
from .max_runtime import MaxRuntime
from ...perf.email import DeletionNotificationWriter, EmailWriter

logger = logging.getLogger(__name__)


class PublicSignatureRemover:
    """
    This class handles the removal of signatures which are (no longer)
    associated to any data point and sends email notifications to the entire team.
    """

    def __init__(
        self,
        timer: MaxRuntime,
        notify_client: taskcluster.Notify,
        max_rows_allowed=None,
        max_emails_allowed=None,
        email_writer: EmailWriter = None,
    ):
        self._notify = notify_client
        self._max_rows_allowed = max_rows_allowed or 50
        self._max_emails_allowed = max_emails_allowed or 10

        self._email_writer = email_writer or DeletionNotificationWriter()
        self.timer = timer

    def remove_in_chunks(self, potentially_empty_signatures: QuerySet):
        emails_sent = 0
        rows_left = self._max_rows_allowed
        chunk_of_signatures = []

        self._remove_empty_try_signatures(potentially_empty_signatures)
        for perf_signature in potentially_empty_signatures:
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

    @staticmethod
    def _remove_empty_try_signatures(signatures: QuerySet):
        try_signatures = signatures.filter(repository__name="try")
        for perf_signature in try_signatures:
            if not perf_signature.has_performance_data():
                perf_signature.delete()

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
        self._notify.email(self._email_writer.email)

    def __delete_and_notify(self, signatures: List[PerformanceSignature]) -> bool:
        """
        Atomically deletes perf signatures & notifies about this.
        @return: whether atomic operation was successful or not
        """

        try:
            self._prepare_notification(signatures)
            with transaction.atomic():
                self._delete(signatures)
                self._send_notification()
        except TaskclusterRestFailure as ex:
            logger.warning(
                f"Failed to atomically delete perf signatures & notify about this. (Reason: {ex})"
            )
            return False

        return True

    def _prepare_notification(self, signatures: List[PerformanceSignature]):
        self._email_writer.prepare_new_email(signatures)
