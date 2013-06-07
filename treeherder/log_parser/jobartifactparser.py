from .logparserbase import BuildbotLogParserBase
from .subparsers import SubParser


class BuildbotJobArtifactParser(BuildbotLogParserBase):
    """
    Gather summary information about this job.

    This parser gathers the data that shows on the bottom panel of the main
    TBPL page.

    Maintains its own state.

    """

    def __init__(self, job_type, url):
        super(BuildbotJobArtifactParser, self).__init__(job_type, url)
        self.sub_parser = SubParser.create(job_type)

    @property
    def name(self):
        try:
            return self.artifact["header"]["builder"]
        except KeyError:
            return "Unknown Builder"

    def parse_content_line(self, line):
        """Parse a single line of the log"""
        self.sub_parser.parse_content_line(line)

    def get_artifact(self):
        """
        Return the job artifact with results from the SubParser
        """
        self.artifact[self.sub_parser.name] = self.sub_parser.get_artifact()
        return self.artifact

    @property
    def parse_complete(self):
        """Whether or not this parser should continue parsing or halt."""
        return self.sub_parser.parse_complete