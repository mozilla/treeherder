#import treeherder.log_splitter


class LogParseManager(object):
    """
    Create a metadata object for all logs of a given ``Job``.

    Given a ``job_id``, gathers all the logs for the given job,
    figures out which parser should be used for that log and
    gathers the results of parsing each one in a metadata object.

    If a log contains another type of log, this figures that out and
    calls the sub-parsers as well.

    Result: Returns a log-metadata artifact object for the UI.

    """

    def __init__(self, job_id):
        # the Table of Contents metadata object
        self.toc = {}
        self.job_id = job_id

    def get_log_list(self):
        """
        Inspect Job and return a list of logs that need parsing.

        Returns a list of ``LogParser`` child objects specific to the
        type of log that needs parsing.

        """

        log_list = []

        # @@@ todo: implement this...

        return log_list

    def get_parsers(self):
        # we always have a SummaryParser
        parser_list = [SummaryParser()]

        # @@@ todo: Figure out the type for the log
        #parser_list.append(FooParser())
        return parser_list

    def parse_logs(self):
        """
        Walk the list of logs and parse each one, building the
        ``log-metadata`` object as we go.
        """
        logs = self.get_log_list()
        parsers = self.get_parsers()
        for log in logs:
            for line in log.readline():
                for parser in parsers:
                    parser.parse_line(line)


class LogParserBase(object):
    """
    Base class for all log parsers.

    Given a log, parse it and generate a meta-data object as a
    Table of Contents for the log.

    """

    def __init__(self):
        # the url of the log to be parsed
        self.metadata = {}
        self.state = "started"

    def get_metadata(self):
        """Return the metadata object"""
        return self.metadata

    def parse_line(self, line):
        """Parse a single line of the log"""
        raise NotImplementedError

    def finalize(self):
        """Wrap-up of this parser, if needed."""
        pass


class SummaryParser(LogParserBase):
    """
    Gather summary information about this job.

    This parser gathers the data that shows on the bottom panel of the main
    TBPL page.

    Maintains its own state
    """
    def parseline(self, line):
        """Parse a single line of the log"""
        pass

    def mark_complete(self):
        """Do any wrap-up of this parse."""
        pass