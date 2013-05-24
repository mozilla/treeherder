import urllib2
import gzip

from .logviewparser import LogViewerParser
from .jobartifactparser import JobArtifactParser


class LogParseCollection(object):
    """
    Run a log through a collection of parsers to get artifacts.

    If a log contains another type of log, this figures that out and
    calls the sub-parsers as well.

    Result: Returns a list of log artifacts

    """

    def __init__(self, url, name, parsers=None):
        """
            ``url`` - url of the log to be parsed
            ``name`` - name of the log to be parsed
            ``parsers`` - LogViewParser instances that should
                be run against the log.
        """

        # the results
        self.artifacts = {}
        self.url = url
        self.name = name

        if parsers:
            # ensure that self.parsers is a list, even if a single parser was
            # passed in
            if not isinstance(parsers, list):
                parsers = [parsers]
            self.parsers = parsers
        else:
            # use the defaults
            self.parsers = [
                JobArtifactParser(),
                LogViewerParser(),
            ]

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        return urllib2.urlopen(url)

    def parse(self):
        """
        Parse the log against each parser.

        This downloads the gz file, uncompresses it, and runs each parser
        against it, building the ``artifact`` as we go.

        """

        # each log url gets opened
        handle = self.get_log_handle(self.url)
        gz_file = gzip.GzipFile(fileobj=handle)

        for line in gz_file:
            # run each parser on each line of the log
            for parser in self.parsers:
                parser.parse_line(line)

        # let the parsers know we're done with all the lines
        for parser in self.parsers:
            parser.finalize()
            self.artifacts[parser.name] = parser.artifact

        gz_file.close()
