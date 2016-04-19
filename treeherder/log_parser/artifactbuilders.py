import logging

from .parsers import (PerformanceParser,
                      StepParser,
                      TinderboxPrintParser)

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
        self.parser = None
        self.name = "Generic Artifact"

    def parse_line(self, line):
        """Parse a single line of the log."""
        # The parser may only need to run until it has seen a specific line.
        # Once that's occurred, it can mark itself as complete, to save
        # being run against later log lines.
        if self.parser.complete:
            return

        # Perf data is stored in a json structure contained in a single line,
        # if the MAX_LINE_LENGTH is applied the data structure could be
        # truncated, preventing it from being ingested.
        if 'PERFHERDER_DATA' not in line:
            line = line[:self.MAX_LINE_LENGTH]

        self.parser.parse_line(line, self.lineno)
        self.lineno += 1

    def finish_parse(self):
        """Run any clean-up/summary actions associated with the parser."""
        # The last lineno seen is one less than ``lineno`` since it's
        # pre-emptively incremented at the end of the parse_line() call.
        last_lineno_seen = self.lineno - 1
        self.parser.finish_parse(last_lineno_seen)

    def get_artifact(self):
        """Return the job artifact built by the parser."""
        self.artifact[self.parser.name] = self.parser.get_artifact()
        return self.artifact


class BuildbotJobArtifactBuilder(ArtifactBuilderBase):
    """
    Gather properties for this job.

    This parser gathers the data that shows in the job details panel.
    """

    def __init__(self, url=None):
        """Construct a job artifact builder."""
        super(BuildbotJobArtifactBuilder, self).__init__(url)
        self.parser = TinderboxPrintParser()
        self.name = "Job Info"


class BuildbotLogViewArtifactBuilder(ArtifactBuilderBase):
    """Makes the artifact for the structured log viewer."""

    def __init__(self, url=None):
        """Construct artifact builder for the log viewer"""
        super(BuildbotLogViewArtifactBuilder, self).__init__(url)
        self.parser = StepParser()
        self.name = "text_log_summary"


class BuildbotPerformanceDataArtifactBuilder(ArtifactBuilderBase):
    """Makes the artifact for performance data."""

    def __init__(self, url=None):
        """Construct artifact builder for generic performance data"""
        super(BuildbotPerformanceDataArtifactBuilder, self).__init__(url)
        self.parser = PerformanceParser()
        self.name = "performance_data"
