"""
This module intends to be a delegate for writing emails.

Its clients should only instantiate their writer of choice &
provide it with some basic data to include in the email.
They then get an email that's ready-to-send via taskcluster.Notify service.
"""

from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod

from typing import List, Tuple, Union

from django.conf import settings
from treeherder.model.models import Push
from treeherder.perf.models import BackfillRecord, PerformanceSignature

FXPERF_TEST_ENG_EMAIL = "perftest-alerts@mozilla.com"  # team' s email


@dataclass
class Email:
    address: str = None
    content: str = None
    subject: str = None

    def as_payload(self) -> dict:
        return asdict(self)


class EmailWriter(ABC):
    def __init__(self):
        self._email = Email()

    def prepare_new_email(self, must_mention: Union[List[object], object]) -> dict:
        """
        Template method
        """
        must_mention = self.__ensure_its_list(must_mention)

        self._write_address()
        self._write_subject()
        self._write_content(must_mention)
        return self.email

    @property
    def email(self):
        return self._email.as_payload()

    @abstractmethod
    def _write_address(self):
        pass  # pragma: no cover

    @abstractmethod
    def _write_subject(self):
        pass  # pragma: no cover

    @abstractmethod
    def _write_content(self, must_mention: List[object]):
        pass  # pragma: no cover

    @staticmethod
    def __ensure_its_list(must_mention) -> List[object]:
        if not isinstance(must_mention, List):
            must_mention = [must_mention]
        return must_mention


# For automatically backfilling performance data
class BackfillReportContent:
    DESCRIPTION = """Perfherder automatically backfills performance jobs originating from Linux platforms.
     It does this every hour, as long as it doesn't exceed the daily limit.
    > __Here's a summary of latest backfills:__
    ---
        """

    TABLE_HEADERS = """
    | Alert summary | Alert | Job symbol | Total backfills (aprox.) | Push range |
    | :---: | :---: | :---: | :---: | :---: |
        """

    def __init__(self):
        self._raw_content = None

    def include_records(self, records: List[BackfillRecord]):
        self._initialize_report_intro()

        for record in records:
            self._include_in_report(record)

    def _initialize_report_intro(self):
        if self._raw_content is None:
            self._raw_content = self.DESCRIPTION + self.TABLE_HEADERS

    def _include_in_report(self, record: BackfillRecord):
        new_table_row = self._build_table_row(record)
        self._raw_content += f"{new_table_row}\n"

    def _build_table_row(self, record: BackfillRecord) -> str:
        alert_summary = record.alert.summary
        alert = record.alert
        job_type = record.job_type
        total_backfills = record.total_backfills_triggered
        push_range = self.__build_push_range(record.get_context())

        # some fields require adjustments
        summary_id = alert_summary.id
        alert_id = alert.id
        job_symbol = str(job_type)

        return f"| {summary_id} | {alert_id} | {job_symbol} | {total_backfills} | {push_range} |"

    def __build_push_range(self, backfill_context: List[dict]) -> str:
        """
        Provides link to Treeherder' s Job view
        """
        from_push, to_push = self.__fetch_border_pushes(backfill_context)  # suspect range as tuple

        # TODO: repository should be provided by upstream (AKA backfill context)
        #  to save some database calls
        repository = from_push.repository.name
        from_change = from_push.revision
        to_change = to_push.revision

        return f"{settings.SITE_URL}/jobs?repo={repository}&fromchange={from_change}&tochange={to_change}"

    def __fetch_border_pushes(self, backfill_context) -> Tuple[Push, Push]:
        from_datapoint = backfill_context[0]
        to_datapoint = backfill_context[-1]

        from_push = from_datapoint['push_id']
        to_push = to_datapoint['push_id']

        from_push = Push.objects.get(id=from_push)
        to_push = Push.objects.get(id=to_push)
        return from_push, to_push

    def __str__(self):
        if self._raw_content is None:
            raise ValueError("No content set")
        return self._raw_content


class BackfillNotificationWriter(EmailWriter):
    def _write_address(self):
        self._email.address = FXPERF_TEST_ENG_EMAIL

    def _write_subject(self):
        self._email.subject = "Automatic Backfilling Report"

    def _write_content(self, must_mention: List[BackfillRecord]):
        content = BackfillReportContent()
        content.include_records(must_mention)

        self._email.content = str(content)


# For performance data cycling
class DeletionReportContent:
    DESCRIPTION = """Perfherder removes performance data that is older than one year and in some cases even sooner, leaving behind performance signatures that aren't associated to any data point. These as well need to be removed.
    > __Here's a summary of recently deleted performance signatures:__
    ---
        """

    TABLE_HEADERS = """
    | Repository | Framework | Platform | Suite | Application |
    | :---: | :---: | :---: | :---: | :---: |
        """

    def __init__(self):
        self._raw_content = None

    def include_signatures(self, signatures: List[PerformanceSignature]):
        self._initialize_report_intro()

        for signature in signatures:
            self._include_in_report(signature)

    def _initialize_report_intro(self):
        if self._raw_content is None:
            self._raw_content = self.DESCRIPTION + self.TABLE_HEADERS

    def _include_in_report(self, signature: PerformanceSignature):
        new_table_row = self._build_table_row(signature)
        self._raw_content += f"{new_table_row}\n"

    def _build_table_row(self, signature: PerformanceSignature) -> str:
        props = self.__extract_properties(signature)

        return '| {repository} | {framework} | {platform} | {suite} | {application} |'.format(
            repository=props["repository"],
            framework=props["framework"],
            platform=props["platform"],
            suite=props["suite"],
            application=props["application"],
        )

    def __extract_properties(self, signature: PerformanceSignature) -> dict:
        return {
            "repository": signature.repository.name,
            "framework": signature.framework.name,
            "platform": signature.platform.platform,
            "suite": signature.suite,
            "application": signature.application,
        }

    def __str__(self):
        if self._raw_content is None:
            raise ValueError("No content set")
        return self._raw_content


class DeletionNotificationWriter(EmailWriter):
    def _write_address(self):
        self._email.address = FXPERF_TEST_ENG_EMAIL

    def _write_subject(self):
        self._email.subject = "Summary of deleted Performance Signatures"

    def _write_content(self, must_mention: List[PerformanceSignature]):
        content = DeletionReportContent()
        content.include_signatures(must_mention)

        self._email.content = str(content)
