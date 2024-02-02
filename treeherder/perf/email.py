"""
This module intends to be a delegate for writing emails.

Its clients should only instantiate their writer of choice &
provide it with some basic data to include in the email.
They then get an email that's ready-to-send via taskcluster.Notify service.
"""
import logging
import re
from dataclasses import dataclass, asdict
from abc import ABC, abstractmethod
import urllib.parse

from typing import Union, Optional

from django.conf import settings
from treeherder.perf.models import (
    BackfillRecord,
    PerformanceSignature,
    PerformanceAlertSummary,
    PerformanceAlert,
)

logger = logging.getLogger(__name__)

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

    def prepare_new_email(self, must_mention: Union[list[object], object]) -> dict:
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
    def _write_content(self, must_mention: list[object]):
        pass  # pragma: no cover

    @staticmethod
    def __ensure_its_list(must_mention) -> list[object]:
        if not isinstance(must_mention, list):
            must_mention = [must_mention]
        return must_mention


# For automatically backfilling performance data
class BackfillReportContent:
    DESCRIPTION = """Perfherder automatically backfills performance jobs originating from {supported_platforms} platform(s).
     It does this every hour, as long as it doesn't exceed the daily limit.
> __Here's a summary of latest backfills:__
---
"""

    TABLE_HEADERS = """
| Alert summary | Alert | Job symbol | Total backfills | Push range |
| :---: | :---: | :---: | :---: | :---: |
"""

    def __init__(self):
        self._raw_content = None

    def include_records(self, records: list[BackfillRecord]):
        self._initialize_report_intro()

        for record in records:
            self._include_in_report(record)

    def _initialize_report_intro(self):
        if self._raw_content is not None:
            return

        description = self.__prepare_report_description()
        self._raw_content = description + self.TABLE_HEADERS

    def __prepare_report_description(self) -> str:
        title_case_platforms = map(lambda platf: platf.title(), settings.SUPPORTED_PLATFORMS)
        platform_enumeration = ", ".join(title_case_platforms)

        description = self.DESCRIPTION.format(supported_platforms=platform_enumeration)
        return description

    def _include_in_report(self, record: BackfillRecord):
        new_table_row = self._build_table_row(record)
        self._raw_content += f"{new_table_row}\n"

    def _build_table_row(self, record: BackfillRecord) -> str:
        alert_summary = record.alert.summary
        alert = record.alert
        job_symbol = self.__escape_markdown(record.job_symbol) or "N/A"
        total_backfills = (
            record.total_backfills_failed
            + record.total_backfills_successful
            + record.total_backfills_in_progress
        )
        push_range_md_link = self.__build_push_range_md_link(record)

        # some fields require adjustments
        summary_md_link = self.__build_summary_md_link(alert_summary)
        alert_id = alert.id

        return f"| {summary_md_link} | {alert_id} | {job_symbol} | {total_backfills} | {push_range_md_link} |"

    @classmethod
    def __build_summary_md_link(cls, alert_summary: PerformanceAlertSummary) -> str:
        """
        @return: hyperlinked summary id, using markdown syntax
        """
        summary_id = alert_summary.id
        hyperlink = f"{settings.SITE_URL}/perfherder/alerts?id={summary_id}"

        return f"[{summary_id}]({hyperlink})"

    def __build_push_range_md_link(self, record: BackfillRecord) -> str:
        """
        Provides link to Treeherder' s Job view
        @return: hyperlinked push range (e.g. autoland:ce483363652d:04a5fe18527d), using markdown syntax
        """
        try:
            text_to_link = self.__build_push_range_cell_text(record.alert)
            hyperlink = self.__build_push_range_link(record)

            return f"[{text_to_link}]({hyperlink})"
        except Exception:
            return "N/A"

    def __build_push_range_link(self, record: BackfillRecord) -> str:
        repo = record.repository.name
        from_change, to_change = record.get_context_border_info("push__revision")

        query_params = f"repo={repo}&fromchange={from_change}&tochange={to_change}"
        query_params = self.__try_embed_search_str(query_params, using_record=record)

        return f"{settings.SITE_URL}/jobs?{query_params}"

    def __try_embed_search_str(
        self,
        query_params: str,
        using_record: BackfillRecord,
    ) -> str:
        search_str = using_record.get_job_search_str()
        if search_str:
            search_str = urllib.parse.quote_plus(search_str)
            query_params = f"{query_params}&searchStr={search_str}"
        else:
            logger.warning(
                f"Failed to enrich push range URL using record with ID {using_record.alert_id}."
            )

        return query_params

    @staticmethod
    def __build_push_range_cell_text(alert: PerformanceAlert) -> str:
        summary = alert.summary
        repository_name = summary.repository.name
        previous_push = summary.prev_push.revision
        push = summary.push.revision

        previous_push = previous_push[:12]
        push = push[:12]

        return f"{repository_name}:{previous_push}:{push}"

    @staticmethod
    def __escape_markdown(text: str) -> Optional[str]:
        """
        Mostly copied "Example 2" from https://www.programcreek.com/python/?CodeExample=escape+markdown
        """
        if text is None:
            return None

        parse = re.sub(r"([_*\[\]()~`>\#\+\-=|\.!])", r"\\\1", text)
        reparse = re.sub(r"\\\\([_*\[\]()~`>\#\+\-=|\.!])", r"\1", parse)
        return reparse

    def __str__(self):
        if self._raw_content is None:
            raise ValueError("No content set")
        return self._raw_content


class BackfillNotificationWriter(EmailWriter):
    def _write_address(self):
        self._email.address = FXPERF_TEST_ENG_EMAIL

    def _write_subject(self):
        self._email.subject = "Automatic Backfilling Report"

    def _write_content(self, must_mention: list[BackfillRecord]):
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
| Repository | Framework | Platform | Suite | Application | Last activity date |
| :---: | :---: | :---: | :---: | :---: | :---: |
"""

    def __init__(self):
        self._raw_content = None

    def include_signatures(self, signatures: list[PerformanceSignature]):
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

        return "| {repository} | {framework} | {platform} | {suite} | {application} | {last_updated} |".format(
            repository=props["repository"],
            framework=props["framework"],
            platform=props["platform"],
            suite=props["suite"],
            application=props["application"],
            last_updated=props["last_updated"],
        )

    def __extract_properties(self, signature: PerformanceSignature) -> dict:
        return {
            "repository": signature.repository.name,
            "framework": signature.framework.name,
            "platform": signature.platform.platform,
            "suite": signature.suite,
            "application": signature.application,
            "last_updated": signature.last_updated.date(),
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

    def _write_content(self, must_mention: list[PerformanceSignature]):
        content = DeletionReportContent()
        content.include_signatures(must_mention)

        self._email.content = str(content)
