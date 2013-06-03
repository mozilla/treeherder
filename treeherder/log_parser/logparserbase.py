import datetime
import re


class LogParserBase(object):
    """
    Base class for all log parsers.

    The child class will know how to parse a particular type of log and
    will keep track of state for started, finished, failed, etc.

    This class is called for each line of the log file, so it has no
    knowledge of the log file itself, as a whole.

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
    # this parser is done, no more need to parse lines
    ST_PARSE_COMPLETE = "parse complete"

    #################
    # regex patterns for started and finished sections
    #################
    RE_HEADER_VALUE = re.compile('^(?P<key>[a-z]+): (?P<value>.*)$')
    PATTERN = ' (.*?) \(results: \d+, elapsed: (?:\d+ mins, )?\d+ secs\) \(at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d+)\) ={9}'
    RE_START = re.compile('={9} Started' + PATTERN)
    RE_FINISH = re.compile('={9} Finished' + PATTERN)
    RE_PROPERTY = re.compile('(\w*): (.*)')
    DATE_FORMAT = '%Y-%m-%d %H:%M:%S.%f'

    def __init__(self, job_type):
        self.artifact = {"header": {}}
        self.state = self.ST_HEADER
        self.job_type = job_type

    @property
    def name(self):
        raise NotImplementedError

    def parsetime(self, match):
        return datetime.datetime.strptime(match, self.DATE_FORMAT)

    def parse_header_line(self, line):
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
        match = self.RE_HEADER_VALUE.match(line)
        if match:
            key, value = match.groups()
            self.artifact["header"][key] = value

    def parse_line(self, line):
        """
        Parse a single line of the log.

        Parse the header until we hit a line with "started" in it.
        """
        if self.state == self.ST_HEADER:
            if not self.RE_START.match(line):
                self.parse_header_line(line)
            else:
                self.state = self.ST_STARTED
                self.parse_content_line(line)
        else:
            self.parse_content_line(line)

    def parse_content_line(self, line):
        """Child class implements to handle parsing of sections"""
        raise NotImplementedError

    @property
    def parse_complete(self):
        """Whether or not this parser is complete and should stop parsing."""
        return self.state == self.ST_PARSE_COMPLETE

    def get_artifact(self):
        """
        Return the job artifact.

        A good place to update the artifact before returning it, if needed.
        This can be handy to get the "final duration" based on the
        last finished section.
        """
        return self.artifact