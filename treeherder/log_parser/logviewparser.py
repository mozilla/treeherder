import re

from .logparserbase import BuildbotLogParserBase
from .subparsers import HeaderParser, StepParser


class BuildbotLogViewParser(BuildbotLogParserBase):
    """
    Makes the artifact for the log viewer.

    The stored object for a log will be

    """

    def __init__(self, job_type, url=None):
        """
        Construct a ``BuildbotLogViewParser``

        Keep track of the current step number, and step artifacts

        Uses a simple ErrorParser to detect errors.  Error lines are added
        to each step they come from.
        """
        super(BuildbotLogViewParser, self).__init__(job_type, url)
        self.sub_parsers = [
            HeaderParser(),
            StepParser()
        ]

    @property
    def name(self):
        """The name of this type of log artifact"""
        return "Structured Log"

