import re

from .logparserbase import LogParserBase


class JobArtifactParser(LogParserBase):
    """
    Gather summary information about this job.

    This parser gathers the data that shows on the bottom panel of the main
    TBPL page.

    Maintains its own state.
    """

    RE_SCRAPE = re.compile('^TinderboxPrint: (.*)$');
    def __init__(self, job_type):
        super(JobArtifactParser, self).__init__(job_type)
        self.scrape = []

    @property
    def name(self):
        try:
            return self.artifact["header"]["builder"]
        except KeyError:
            return "Unknown Builder"

    def parse_content_line(self, line):
        """Parse a single line of the log"""
        match = self.RE_SCRAPE.match(line)
        if match:
            self.scrape.append(match.group(1))

    def finalize(self):
        """Do any wrap-up of this parser."""
        pass

