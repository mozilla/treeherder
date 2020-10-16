import math
from typing import List

from treeherder.perf.models import PerformanceDatum, PerformanceSignature
from treeherder.services.taskcluster import TaskclusterModel
from treeherder.services.max_runtime import MaxRuntime

RECEIVER_TEAM_EMAIL = "perftest-alerts@mozilla.com"
EMAIL_RECEIVER = "dhunt@mozilla.com"


class PublicSignaturesRemover:
    """
    This class handles the removal of signatures which are (no longer)
    associated with a job and sends email notifications to the entire team.
    """

    html_content = """
        <html>
            <head>
            </head>
            <body>
                <h2>Summary of deleted Performance Signatures</h2>
                <table>
                    <tr>
                        <th>repository</th>
                        <th>framework</th>
                        <th>platform</th>
                        <th>suite</th>
                        <th>application</th>
                    </tr>
    """

    end_of_html_content = """
                </table>
            </body>
        </html>
    """

    def __init__(
        self,
        timer: MaxRuntime,
        taskcluster_model: TaskclusterModel,
    ):
        self.tc_model = taskcluster_model
        self._subject = "Summary of deleted Performance Signatures"
        self._content = None
        self._nr_rows_allowed = 10  # TO BE DEFINED
        self._nr_emails_allowed = 4  # TO BE DEFINED

        self.timer = timer

    def remove(self):
        deleted_signatures = []
        nr_signatures_to_remove = self.__nr_signatures_to_remove
        for signature in PerformanceSignature.objects.all():
            self.timer.quit_on_timeout()

            if (
                not PerformanceDatum.objects.filter(
                    repository_id=signature.repository_id,  # leverages (repository, signature) compound index
                    signature_id=signature.id,
                ).exists()
                and nr_signatures_to_remove != 0
            ):
                nr_signatures_to_remove -= 1
                signature_properties = self.__extract_properties(signature)
                deleted_signatures.append(signature_properties)
                signature.delete()
            elif nr_signatures_to_remove == 0:
                break

        self._ping_email_service()
        self._send_emails(RECEIVER_TEAM_EMAIL, deleted_signatures)

    @property
    def __nr_signatures_to_remove(self):
        return self._nr_rows_allowed * self._nr_emails_allowed

    def __number_of_emails_to_send(self, nr_of_deleted_signatures: int):
        return math.ceil(nr_of_deleted_signatures / self._nr_rows_allowed)

    def _ping_email_service(self):
        self.tc_model.notify.ping()

    def _send_emails(self, address: str, signatures: List[dict]):
        number_of_emails = self.__number_of_emails_to_send(len(signatures))
        for idx in range(0, number_of_emails):
            self._send_email(
                address, signatures[idx * self._nr_rows_allowed : (idx + 1) * self._nr_rows_allowed]
            )

    def _send_email(self, address: str, signatures: List[dict]):
        self.__set_html_content(signatures)
        payload = {
            "address": address,
            "content": self._content,
            "subject": self._subject,
        }
        self.tc_model.notify.email(payload)

    def __set_html_content(self, signatures: List[dict]):
        self._content = self.html_content
        for signature in signatures:
            signature_row = self.__transform_signature_in_html(signature)
            self._content += signature_row
        self._content += self.end_of_html_content

    @staticmethod
    def __transform_signature_in_html(signature: dict):
        signature_row = """
            <tr>
                <td>{repository}</td>
                <td>{framework}</td>
                <td>{platform}</td>
                <td>{suite}</td>
                <td>{application}</td>
            </tr>
        """.format(
            repository=signature["repository"],
            framework=signature["framework"],
            platform=signature["platform"],
            suite=signature["suite"],
            application=signature["application"],
        )

        return signature_row

    @staticmethod
    def __extract_properties(signature):
        return {
            "repository": signature.repository,
            "framework": signature.framework,
            "platform": signature.platform,
            "suite": signature.suite,
            "application": signature.application,
        }
