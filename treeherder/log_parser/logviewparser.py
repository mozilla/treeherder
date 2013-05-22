from .logparserbase import LogParserBase


class LogViewerParser(LogParserBase):
    """
    Makes the artifact for the log viewer.

    Store the resulting artifact in the DB gzipped.  Then the client
    will uncompress in JS.

    The stored object for a log will be
        "steps": [
            {
                "name": "unittest"  # the name of the process btw start/finish
                "order": 1          # the order the process came in the log file
                "errors_lines": [],
                "error_count": 2,   # count of error lines
                "duration": 23.5,   # in minutes
                "content": "text"
            },
            ...
        ]

    """
    @property
    def name(self):
        return "Structured Log"

    def parse_content(self, line):
        """Child class implements to handle parsing of sections"""
        raise NotImplementedError
