import datetime
import time
import re


class BuildbotLogParserBase(object):
    """
    Base class for all Buildbot log parsers.

    The child class will be designed to create a particular type of artifact.

    This class is called for each line of the log file, so it has no
    knowledge of the log file itself, as a whole.  It only, optionally, has
    the url to the log file to add to its own artifact.

    """

    #################
    # state constants
    #################

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

    def __init__(self, job_type, url=None):
        """
        Create the LogParser

        ``job_type`` - Something like "mochitest" or "reftest", etc.
        ``url`` - The url this log comes from.  It's optional, but it gets
                  added to the artifact.
        """
        self.artifact = {
            "header": {},
            "url": url
        }
        self.state = self.ST_HEADER
        self.job_type = job_type
        self.lineno = 0
        # the first start time
        self.first_starttime = None
        # the last finish time
        self.last_finishtime = None

    @property
    def name(self):
        """Return the name used to store this in the collection's artifact"""
        raise NotImplementedError  # pragma nocover

    def parsetime(self, match):
        """Convert a string date into a datetime."""
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
            match = self.RE_START.match(line)
            if not match:
                self.parse_header_line(line)
            else:
                self.state = self.ST_STARTED
                self.parse_content_line(line)
        else:
            match = self.RE_FINISH.match(line)
            if match:
                self.artifact["header"]["finishtime"] = self.parsetime(
                    match.group(2)).strftime("%s")
            self.parse_content_line(line)

        self.lineno += 1

    def parse_content_line(self, line):
        """Child class implements to handle parsing of non-header data"""
        raise NotImplementedError  # pragma nocover

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
