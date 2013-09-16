from .parsers import (ErrorParser, TinderboxPrintParser,
                      HeaderParser, StepParser)


class ArtifactBuilderBase(object):
    """
    Base class for all Buildbot log parsers.

    The child class will be designed to create a particular type of artifact.

    This class is called for each line of the log file, so it has no
    knowledge of the log file itself, as a whole.  It only, optionally, has
    the url to the log file to add to its own artifact.

    """

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

    @property
    def name(self):
        """Return the name used to store this in the collection's artifact"""
        raise NotImplementedError  # pragma nocover

    def parse_line(self, line):
        """Parse a single line of the log."""

        for parser in self.parsers:
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
    Gather error and tinderbox print lines for this job.

    This parser gathers the data that shows on the bottom panel of the main
    TBPL page.

    """

    def __init__(self, url=None):
        """Construct a job artifact builder."""
        super(BuildbotJobArtifactBuilder, self).__init__(url)
        self.parsers = [
            TinderboxPrintParser(),
        ]

    @property
    def name(self):
        """Name that can be used to identify this type of artifact"""
        try:
            builder = self.artifact["builder"]
        except KeyError:
            builder = "Unknown Builder"
        return "{0} Job Artifact".format(builder)


class BuildbotLogViewArtifactBuilder(ArtifactBuilderBase):
    """Makes the artifact for the structured log viewer."""

    def __init__(self, url=None, check_errors=True):
        """Construct artifact builder for the log viewer"""
        super(BuildbotLogViewArtifactBuilder, self).__init__(url)
        self.parsers = [
            HeaderParser(),
            StepParser(check_errors)
        ]

    @property
    def name(self):
        """Name that can be used to identify this type of artifact"""
        return "Structured Log"
