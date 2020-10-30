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
        self._nr_of_rows_allowed_in_email = 10  # TO BE DEFINED
        self._nr_of_emails_allowed = 4  # TO BE DEFINED

        self.timer = timer

    def remove(self):
        nr_of_emails_sent_so_far = 0

        nr_of_rows_left_to_complete_email = self._nr_of_rows_allowed_in_email
        chunk_of_signatures = []

        for performance_signature in PerformanceSignature.objects.all():
            self.timer.quit_on_timeout()

            if nr_of_emails_sent_so_far != self._nr_of_emails_allowed and (
                not PerformanceDatum.objects.filter(
                    repository_id=performance_signature.repository_id,  # leverages (repository, signature) compound index
                    signature_id=performance_signature.id,
                ).exists()
            ):
                nr_of_rows_left_to_complete_email -= 1
                chunk_of_signatures.append(performance_signature)

            elif nr_of_emails_sent_so_far == self._nr_of_emails_allowed:
                break

            if nr_of_rows_left_to_complete_email == 0:
                # check if Taskcluster Notify Service is up
                self._ping_email_service()
                # extract the proprieties of interest from signatures in a list of dictionaries
                email_content = self.__extract_properties_from_signatures(chunk_of_signatures)
                # delete signatures
                for signature in chunk_of_signatures:
                    signature.delete()
                # send email to the team with summary of signatures just deleted
                self._send_email(RECEIVER_TEAM_EMAIL, email_content)

                nr_of_emails_sent_so_far += 1
                chunk_of_signatures = []
                nr_of_rows_left_to_complete_email = self._nr_of_rows_allowed_in_email

        if nr_of_emails_sent_so_far != self._nr_of_emails_allowed and chunk_of_signatures != []:
            self._ping_email_service()
            email_content = self.__extract_properties_from_signatures(chunk_of_signatures)
            for signature in chunk_of_signatures:
                signature.delete()
            self._send_email(RECEIVER_TEAM_EMAIL, email_content)

    def _ping_email_service(self):
        self.tc_model.notify.ping()

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
    def __extract_properties_from_signatures(signatures):
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
