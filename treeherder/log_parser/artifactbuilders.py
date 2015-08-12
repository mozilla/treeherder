# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import logging
from contextlib import closing

import requests
from django.conf import settings
from django.utils.six import BytesIO
from mozlog.structured import reader

from .parsers import StepParser, TalosParser, TinderboxPrintParser

logger = logging.getLogger(__name__)


class ArtifactBuilderBase(object):
    """
    Base class for all Buildbot log parsers.

    The child class will be designed to create a particular type of artifact.

    This class is called for each line of the log file, so it has no
    knowledge of the log file itself, as a whole.  It only, optionally, has
    the url to the log file to add to its own artifact.

    """
    MAX_LINE_LENGTH = 500

    def __init__(self, url=None):
        """
        Create the LogParser

        ``url`` - The url this log comes from.  It's optional, but it gets
                  added to the artifact.
        """
        self.artifact = {
            "logurl": url
        }
        self.lineno = 0
        self.parsers = []
        self.name = "Generic Artifact"

    def parse_line(self, line):
        """Parse a single line of the log."""

        """
        Talos data is stored in a json structure contained in
        a single line, if the MAX_LINE_LENGTH is applied the
        data structure could be truncated preventing it from
        being ingested.
        """
        if "TALOSDATA" not in line and 'TalosResult' not in line:
            line = line[:self.MAX_LINE_LENGTH]

        for parser in self.parsers:
            # Some parsers only need to run until they've seen a specific line.
            # Once that's occurred, they mark themselves as complete, to save
            # being included in the set of parsers run against later log lines.
            if not parser.complete:
                parser.parse_line(line, self.lineno)

        self.lineno += 1

    def get_artifact(self):
        """Return the job artifact built from all parsers."""
        for sp in self.parsers:
            self.artifact[sp.name] = sp.get_artifact()
        return self.artifact


class BuildbotJobArtifactBuilder(ArtifactBuilderBase):
    """
    Gather error and details for this job.

    This parser gathers the data that shows in the job details panel.
    """

    def __init__(self, url=None):
        """Construct a job artifact builder."""
        super(BuildbotJobArtifactBuilder, self).__init__(url)
        self.parsers = [
            TinderboxPrintParser()
        ]
        self.name = "Job Info"


class BuildbotLogViewArtifactBuilder(ArtifactBuilderBase):
    """Makes the artifact for the structured log viewer."""

    def __init__(self, url=None, check_errors=True):
        """Construct artifact builder for the log viewer"""
        super(BuildbotLogViewArtifactBuilder, self).__init__(url)
        self.parsers = [
            StepParser(check_errors=check_errors)
        ]
        self.name = "text_log_summary"


class BuildbotPerformanceDataArtifactBuilder(ArtifactBuilderBase):
    """Makes the artifact for performance data."""

    def __init__(self, url=None, check_errors=True):
        """Construct artifact builder for the log viewer"""
        super(BuildbotPerformanceDataArtifactBuilder, self).__init__(url)
        self.parsers = [
            TalosParser()
        ]
        self.name = "talos_data"


class MozlogArtifactBuilder(ArtifactBuilderBase):
    """Extracts a summary artifact from a Mozlog log"""
    def __init__(self, url=None):
        """Construct artifact builder for the log viewer"""
        super(MozlogArtifactBuilder, self).__init__(url)
        self.name = "json_log_summary"
        self.url = url

    class SummaryHandler(object):
        def __init__(self):
            self.serial = 0
            self.lines = []

        def is_fault(self, message):
            try:
                return any(["level" in message and
                            message["level"] in ("ERROR", "WARNING", "CRITICAL"),
                            "expected" in message,
                            message["action"] == "crash"])
            except:
                logger.warning("SummaryHandler line exception {0}".format(message))
                return False

        def __call__(self, data):
            self.serial += 1

            if self.is_fault(data):
                data['serial'] = self.serial
                self.lines.append(data)
            if len(self.lines) > settings.PARSER_MAX_SUMMARY_LINES:
                self.lines = self.lines[:settings.PARSER_MAX_SUMMARY_LINES]
                raise StopIteration

            return None

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        return closing(BytesIO(requests.get(
               url,
               timeout=settings.TREEHERDER_REQUESTS_TIMEOUT
        ).content))

    def parse_log(self):
        """
        Parse the entire log with ``mozlog``.

        This presumes that the log at ``log_url`` is a gzipped structured
        log generated by ``mozlog``.
        """
        handler = self.SummaryHandler()

        with self.get_log_handle(self.url) as in_f:
            try:
                reader.handle_log(reader.read(in_f), handler)
                self.artifact["errors_truncated"] = False
            except StopIteration:
                # cap out the number of lines we store in the artifact.
                self.artifact["errors_truncated"] = True

        self.artifact["all_errors"] = handler.lines
