import urllib2
import gzip
import datetime
import re

from treeherder.model.derived.jobs import JobsModel


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

    def __init__(self, project, job_id):
        # the Table of Contents metadata object
        self.toc = {}
        self.job_id = job_id
        self.project = project
        self.jm = JobsModel(self.project)

    def get_log_references(self):
        """
        Inspect Job and return a list of logs that need parsing.

        These will be url strings for each log over ftp.

        """
        return self.jm.get_log_references(self.job_id)

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

        # we always have a SummaryParser
        parser_list = [SummaryParser()]

        # @@@ todo: Figure out the type for the log based on the name
        #           in the log_references?
        #parser_list.append(FooParser())
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

        logs = self.get_log_references()
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
        If so, we will need to make the patterns more modular than this.
        Or perhaps have a different base class for other types of parsers.

    """

    #################
    # state constants
    #################
    # @@@ My thought here is that if/when the child class has sub states within
    #     ``started`` (or other states) they could concatenate that state
    #     string to it, thereby making it a sub-state.  You could check for
    #     the greater ``started`` by using ``startswith`` on the state.

    # while still reading the initial header section
    ST_HEADER = 'header'
    # after having started any section
    ST_STARTED = "started"
    # after having finished any section
    ST_FINISHED = "finished"

    #################
    # regex patterns for started and finished sections
    #################
    RE_HEADER_VALUE = re.compile('^(?P<key>[a-z]+): (?P<value>.*)$')
    PATTERN = ' (.*?) \(results: \d+, elapsed: (?:\d+ mins, )?\d+ secs\) \(at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d+)\) ={9}'
    RE_START = re.compile('={9} Started' + PATTERN)
    RE_FINISH = re.compile('={9} Finished' + PATTERN)
    RE_PROPERTY = re.compile('(\w*): (.*)')
    DATE_FORMAT = '%Y-%m-%d %H:%M:%S.%f'
    STARTED = b'========= Started'

    def __init__(self):
        self.metadata = {"header": {}}
        self.state = self.ST_HEADER

    def parsetime(self, match):
        return datetime.datetime.strptime(match, self.DATE_FORMAT)

    def get_metadata(self):
        """Return the collected metadata object"""
        return self.metadata

    def parse_header(self, line):
        """
        Parse out a value in the header

        The header values in the log look like this:
            builder: mozilla-central_ubuntu32_vm_test-crashtest-ipc
            slave: tst-linux32-ec2-137
            starttime: 1368466076.01
            results: success (0)
            buildid: 20130513091541
            builduid: acddb5f7043c4d5b9f66619f9433cab0
            revision: c80dc6ffe865

        """
        print "parsing: {0}".format(line)
        match = self.RE_HEADER_VALUE.match(line)
        if match:
            key, value = match.groups()
            self.metadata["header"][key] = value

    def parse_line(self, line):
        """
        Parse a single line of the log.

        Parse the header until we hit a line with "started" in it.
        """
        if self.state == self.ST_HEADER:
            if not line.startswith(self.STARTED):
                self.parse_header(line)
            else:
                self.state = self.ST_STARTED
                self.parse_content(line)
        else:
            self.parse_content(line)

    def parse_content(self, line):
        """Child class implements to handle parsing of sections"""
        raise NotImplementedError

    def finalize(self):
        """
        Wrap-up of this parser, if needed.

        This can be handy to get the "final duration" based on the
        last finished section.
        """
        pass


class SummaryParser(LogParserBase):
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