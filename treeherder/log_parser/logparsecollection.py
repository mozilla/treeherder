import urllib2
import gzip

from .logviewparser import LogViewerParser
from .jobartifactparser import JobArtifactParser


class LogParseCollection(object):
    """
    Create a metadata object for all logs of a given ``Job``.

    Given a list of log_urls, figures out which parser should be used for each
    log and gathers the results of parsing each one in a metadata object.

    If a log contains another type of log, this figures that out and
    calls the sub-parsers as well.

    Result: Returns a log-metadata artifact object for the UI.

    """

    def __init__(self, project, log_references):
        # the Table of Contents metadata object
        self.toc = {}
        self.log_references = log_references
        self.project = project

    def get_parsers(self):
        """
        Returns a list of ``LogParser`` child objects specific to the
        type of log that needs parsing.

        @@@ - not clear if I'll need to map logs to a list of parsers
              for them.  Need to figure out if there will be different
              types of logs for a single job.  There ARE logs within logs
              (like Mochitest) but that would be handled by the Parser
              knowing it needs a sub-parser.
              Still working this out...

        """

        parser_list = [JobArtifactParser(), LogViewerParser()]
        return parser_list

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        return urllib2.urlopen(url)

    def parse_logs(self):
        """
        Walk the list of logs and parse each one.

        This downloads each gz file, uncompresses it, and runs each parser
        against it, building the ``log-metadata`` object as we go.

        """

        logs = self.log_references
        parsers = self.get_parsers()

        for log in logs:
            # each log url gets opened
            handle = self.get_log_handle(log["url"])
            gz_file = gzip.GzipFile(fileobj=handle)

            for line in gz_file:
                # run each parser on each line of the log
                for parser in parsers:
                    parser.parse_line(line)

            # let the parsers know we're done with all the lines
            for parser in parsers:
                parser.finalize()

            gz_file.close()
            self.toc[log["name"]] = parser.metadata

