from .logparserbase import BuildbotLogParserBase
from .subparsers import ErrorParser, TinderboxPrintParser


class BuildbotJobArtifactParser(BuildbotLogParserBase):
    """
    Gather error and tinderbox print lines for this job.

    This parser gathers the data that shows on the bottom panel of the main
    TBPL page.

    """

    def __init__(self, job_type, url):
        super(BuildbotJobArtifactParser, self).__init__(job_type, url)
        self.parsers = [
            ErrorParser(),
            TinderboxPrintParser(),
        ]

    @property
    def name(self):
        try:
            builder = self.artifact["builder"]
        except KeyError:
            builder = "Unknown Builder"
        return "{0} Job Artifact".format(builder)
