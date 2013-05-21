from .logparserbase import LogParserBase


class JobArtifactParser(LogParserBase):
    """
    Gather summary information about this job.

    This parser gathers the data that shows on the bottom panel of the main
    TBPL page.

    Maintains its own state.

    @@@ probably should go in a different file, too?
    """
    def parse_content(self, line):
        """Parse a single line of the log"""
        pass

    def finalize(self):
        """Do any wrap-up of this parser."""
        pass
