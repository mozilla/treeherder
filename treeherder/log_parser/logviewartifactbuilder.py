import re

from .artifactbuilderbase import ArtifactBuilderBase
from .parsers import HeaderParser, StepParser


class BuildbotLogViewArtifactBuilder(ArtifactBuilderBase):
    """
    Makes the artifact for the log viewer.

    The stored object for a log will be

    """

    def __init__(self, job_type, url=None):
        """
        Construct artifact builder for the log viewer

        Keep track of the current step number, and step artifacts

        Uses a simple ErrorParser to detect errors.  Error lines are added
        to each step they come from.
        """
        super(BuildbotLogViewArtifactBuilder, self).__init__(job_type, url)
        self.sub_parsers = [
            HeaderParser(),
            StepParser()
        ]

    @property
    def name(self):
        """The name of this type of log artifact"""
        return "Structured Log"
