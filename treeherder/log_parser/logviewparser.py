from .logparserbase import LogParserBase


class LogViewerParser(LogParserBase):
    """
    Makes the artifact for the log viewer.

    Store the resulting artifact in the DB gzipped.  Then the client
    will uncompress in JS.

    """

    def parse_content(self, line):
        """Child class implements to handle parsing of sections"""
        raise NotImplementedError
