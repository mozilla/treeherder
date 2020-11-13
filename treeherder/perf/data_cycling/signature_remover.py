import logging
from typing import List

from treeherder.services.taskcluster import TaskclusterModel
from treeherder.perf.data_cycling.max_runtime import MaxRuntime

logger = logging.getLogger(__name__)

RECEIVER_TEAM_EMAIL = "perftest-alerts@mozilla.com"
RECEIVER_EMAIL = "dhunt@mozilla.com"


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

        logger.warning('Removing performance signatures with missing jobs...')
        for perf_signature in signatures:
            self.timer.quit_on_timeout()

            if emails_sent < self._max_emails_allowed and (
                not perf_signature.has_performance_data()
            ):
                rows_left -= 1
                chunk_of_signatures.append(perf_signature)

                if rows_left == 0:
                    # extract the proprieties of interest from signatures in a list of dictionaries
                    email_data = self.__extract_properties(chunk_of_signatures)
                    # check if Taskcluster Notify Service is up
                    try:
                        self.tc_model.notify.ping()
                    except Exception:
                        logger.warning(
                            "Failed to delete signatures because the Notify Service is not available"
                        )
                        break
                    else:
                        self._delete(chunk_of_signatures)
                        self._send_notification(email_data)

                    emails_sent += 1
                    chunk_of_signatures = []
                    rows_left = self._max_rows_allowed

        if emails_sent < self._max_emails_allowed and chunk_of_signatures != []:
            # extract the proprieties of interest from signatures in a list of dictionaries
            email_data = self.__extract_properties(chunk_of_signatures)
            # check if Taskcluster Notify Service is up
            try:
                self.tc_model.notify.ping()
            except Exception:
                logger.warning(
                    "Failed to delete signatures because the Notify Service is not available"
                )
            else:
                self._delete(chunk_of_signatures)
                self._send_notification(email_data)

    def _send_notification(self, email_data):
        logger.warning("Sending email with summary of deleted perf signatures to team...")
        self._send_email(RECEIVER_TEAM_EMAIL, email_data)
        self._send_email(RECEIVER_EMAIL, email_data)

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
