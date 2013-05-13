import urllib2
import gzip
import datetime
import re


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

        These will be url strings for each log over ftp.

        """

        log_list = []

        # @@@ todo: implement this...

        return log_list

    def get_parsers(self):
        """
        Returns a list of ``LogParser`` child objects specific to the
        type of log that needs parsing.
        """

        # we always have a SummaryParser
        parser_list = [SummaryParser()]

        # @@@ todo: Figure out the type for the log
        #parser_list.append(FooParser())
        return parser_list

    def parse_logs(self):
        """
        Walk the list of logs and parse each one.

        This downloads each gz file, uncompresses it, and runs each parser
        against it, building the ``log-metadata`` object as we go.

        """

        logs = self.get_log_list()
        parsers = self.get_parsers()

        for log in logs:
            # each log url gets opened
            handle = urllib2.urlopen(log)
            gz_file = gzip.GzipFile(fileobj=handle)

            for line in gz_file.readline():
                # run each parser on each line of the log
                for parser in parsers:
                    parser.parse_line(line)

            # let the parsers know we're done with all the lines
            for parser in parsers:
                parser.finalize()

            gz_file.close()


class LogParserBase(object):
    """
    Base class for all log parsers.

    The child class will know how to parse a particular type of log and
    will keep track of state for started, finished, failed, etc.

    This class is called for each line of the log file, so it has no
    knowledge of the log file itself, as a whole.

    Once finalize() is done, the generated metadata object should be
    ready as a Table of Contents (of sorts) for the log.

    @@@ Question: This class presumes started/finished regex's based on
        buildbot results.  Do we need to support other types?
        If so, we may want to make the patterns more modular than this.
        Or perhaps have a different base class for other types of parsers.

    """

    # state constants

    # while still reading the initial header section
    ST_HEADER = 'header'
    # after having started any section
    ST_STARTED = "started"
    # after having finished any section
    ST_FINISHED = "finished"

    # regex patterns for started and finished sections
    pattern = ' (.*?) \(results: \d+, elapsed: (?:\d+ mins, )?\d+ secs\) \(at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d+)\) ={9}'
    re_start = re.compile('={9} Started' + pattern)
    re_finish = re.compile('={9} Finished' + pattern)
    re_property = re.compile('(\w*): (.*)')
    date_format = '%Y-%m-%d %H:%M:%S.%f'

    def parsetime(self, match):
        return datetime.datetime.strptime(match, self.date_format)

    def __init__(self):
        self.metadata = {"header": {}}
        self.state = self.ST_HEADER

    def get_metadata(self):
        """Return the collected metadata object"""
        return self.metadata

    def parse_header(self, line):
        """Parse out a value in the header"""
        header = line.split(": ", 1)
        if len(header == 2):
            self.metadata["header"][header[0]] = header[1]

    def parse_line(self, line):
        """Parse a single line of the log"""
        if self.state == self.ST_HEADER:
            self.parse_header(line)
        else:
            self.parse_content(line)

    def parse_content(self, line):
        """Child class implements to handle parsing of sections"""
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