from .artifactbuilderbase import  ArtifactBuilderBase
from .parsers import ErrorParser, TinderboxPrintParser


class BuildbotJobArtifactBuilder(ArtifactBuilderBase):
    """
    Gather error and tinderbox print lines for this job.

    This parser gathers the data that shows on the bottom panel of the main
    TBPL page.

    """

    def __init__(self, job_type, url):
        super(BuildbotJobArtifactBuilder, self).__init__(job_type, url)
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
