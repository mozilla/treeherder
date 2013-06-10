import re

from .logparserbase import BuildbotLogParserBase
from .subparsers import SubParser, TinderboxPrintSubParser


class BuildbotJobArtifactParser(BuildbotLogParserBase):
    """
    Gather summary information about this job.

    This parser gathers the data that shows on the bottom panel of the main
    TBPL page.

    Maintains its own state.

    """

    def __init__(self, job_type, url):
        super(BuildbotJobArtifactParser, self).__init__(job_type, url)
        self.sub_parsers = [
            SubParser.create(job_type),
            TinderboxPrintSubParser(),
        ]

    @property
    def name(self):
        try:
            return self.artifact["header"]["builder"]
        except KeyError:
            return "Unknown Builder"

    def parse_content_line(self, line):
        """Parse a single line of the log"""
        for sp in self.sub_parsers:
            sp.parse_content_line(line)

    def get_artifact(self):
        """
        Return the job artifact with results from the SubParser
        """
        for sp in self.sub_parsers:
            self.artifact[sp.name] = sp.get_artifact()
        return self.artifact

    @property
    def parse_complete(self):
        """Whether or not this parser should continue parsing or halt."""
        return all([x.parse_complete for x in self.sub_parsers])
