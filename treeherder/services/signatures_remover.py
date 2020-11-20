import logging
from typing import List

from treeherder.perf.models import PerformanceDatum, PerformanceSignature
from treeherder.services.taskcluster import TaskclusterModel
from treeherder.services.max_runtime import MaxRuntime

logger = logging.getLogger(__name__)

RECEIVER_TEAM_EMAIL = "perftest-alerts@mozilla.com"
RECEIVER_EMAIL = "dhunt@mozilla.com"


class PublicSignaturesRemover:
    """
    This class handles the removal of signatures which are (no longer)
    associated with a job and sends email notifications to the entire team.
    """

    table_description = """__Summary of recently deleted Performance Signatures__
> The signatures below were deleted due to the fact that they were no longer associated with a job.
---
    """

    table_headers = """
| Repository | Framework | Platform | Suite | Application |
| :---: | :---: | :---: | :---: | :---: |
    """

    def __init__(
        self,
        timer: MaxRuntime,
        taskcluster_model: TaskclusterModel,
        nr_of_rows_allowed=None,
        nr_of_emails_allowed=None,
    ):
        self.tc_model = taskcluster_model
        self._subject = "Summary of deleted Performance Signatures"
        self._content = None
        self._nr_of_rows_allowed = nr_of_rows_allowed or 50
        self._nr_of_emails_allowed = nr_of_emails_allowed or 10

        self.timer = timer

    def remove_in_chunks(self, max_timestamp):
        chunk_of_signatures = []
        max_nr_signatures = self._nr_of_rows_allowed * self._nr_of_emails_allowed

        for performance_signature in PerformanceSignature.objects.filter(
            last_updated__lte=max_timestamp
        ):
            self.timer.quit_on_timeout()

            if len(chunk_of_signatures) < max_nr_signatures:
                if not PerformanceDatum.objects.filter(
                    repository_id=performance_signature.repository_id,  # leverages (repository, signature) compound index
                    signature_id=performance_signature.id,
                ).exists():
                    chunk_of_signatures.append(performance_signature)
            else:
                break

        for i in range(0, self._nr_of_emails_allowed):
            chunk = chunk_of_signatures[
                i * self._nr_of_rows_allowed : (i + 1) * self._nr_of_rows_allowed
            ]
            if chunk:
                # extract the proprieties of interest from signatures in a list of dictionaries
                email_content = self.__extract_properties(chunk)
                # check if Taskcluster Notify Service is up
                try:
                    self.tc_model.notify.ping()
                except Exception:
                    logger.warning("Taskcluster Notify Service is not available")
                    logger.warning("Failed to delete performance signatures")
                else:
                    self._delete(chunk)
                    self._send_notification(email_content)

    def _send_notification(self, email_content):
        logger.warning("Sending email with summary of deleted perf signatures to team...")
        self._send_email(RECEIVER_TEAM_EMAIL, email_content)
        self._send_email(RECEIVER_EMAIL, email_content)

    @staticmethod
    def _delete(chunk_of_signatures):
        logger.warning('Removing performance signatures with missing jobs...')
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
        self._content = self.table_description + self.table_headers
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
        proprieties = []
        for signature in signatures:
            signature_proprieties = {
                "repository": signature.repository,
                "framework": signature.framework,
                "platform": signature.platform,
                "suite": signature.suite,
                "application": signature.application,
            }
            proprieties.append(signature_proprieties)
        return proprieties
