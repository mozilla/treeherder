# These parsers are specific to sections of a buildbot log.  They are specific
# to the build or test type that the log section is about

import re
import datetime


class ParserBase(object):
    """
    Base class for all subparsers.

    Gives basic generic functionality functions.
    """
    def __init__(self, name):
        """Setup the artifact to hold the extracted data."""
        self.artifact = []
        self.name = name
        self.parse_complete = False

    def parse_line(self, line, lineno):
        """Parse a single line of the log"""
        raise NotImplementedError

    def get_artifact(self):
        """By default, just return the artifact as-is."""
        return self.artifact


class HeaderParser(ParserBase):

    RE_HEADER_VALUE = re.compile('^(?P<key>[a-z]+): (?P<value>.*)$')
    RE_START = re.compile('={9} Started')

    def __init__(self):
        """Setup the artifact to hold the header lines."""
        super(HeaderParser, self).__init__("header")
        # for this parser, we actually want the artifact to be a dict instead
        # of a list.
        self.artifact = {}

    def parse_line(self, line, lineno):
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
        if self.RE_START.match(line):
            self.parse_complete = True
            return

        match = self.RE_HEADER_VALUE.match(line)
        if match:
            key, value = match.groups()
            self.artifact[key] = value


class StepParser(ParserBase):
    """
    Parse out buildbot steps.

    Step format:
        "steps": [
        {
            "errors": [],
            "name": "set props: master", # the name of the process on start line
            "started": "2013-06-05 12:39:57.838527",
            "started_linenumber": 8,
            "finished_linenumber": 10,
            "finished": "2013-06-05 12:39:57.839226",
            "error_count": 0,
            "duration": 0.000699, # in seconds
            "order": 0  # the order the process came in the log file
        },
        ...
    ]

    """

    # after having started any section
    ST_STARTED = "started"
    # after having finished any section
    ST_FINISHED = "finished"
    # date format in a step started/finished header
    DATE_FORMAT = '%Y-%m-%d %H:%M:%S.%f'

    PATTERN = (" (.*?) \(results: \d+, elapsed: (?:\d+ mins, )?\d+ secs\) "
               "\(at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d+)\) ={9}")
    RE_START = re.compile('={9} Started' + PATTERN)
    RE_FINISH = re.compile('={9} Finished' + PATTERN)

    def __init__(self):
        """Setup the artifact to hold the header lines."""
        super(StepParser, self).__init__("steps")
        self.stepnum = -1
        self.artifact = {
            "steps": [],
            "errors": []
        }
        self.sub_parser = ErrorParser()

    def parse_line(self, line, lineno):
        """Parse a single non-header line of the log"""

        # check if it's the start of a step
        match = self.RE_START.match(line)
        if match:
            self.state = self.ST_STARTED
            self.stepnum += 1
            self.steps.append({
                "name": match.group(1),
                "started": match.group(2),
                "started_linenumber": lineno,
                "order": self.stepnum,
                "errors": [],
            })

            return

        # check if it's the end of a step
        match = self.RE_FINISH.match(line)
        if match:
            self.state = self.ST_FINISHED

            self.current_step.update({
                "finished": match.group(2),
                "finished_linenumber": lineno,
                "errors": self.sub_parser.get_artifact(),
            })
            self.set_duration()
            self.current_step["error_count"] = len(self.current_step["errors"])

            # reset the sub_parser for the next step
            self.sub_parser = ErrorParser()
            return

        # call the subparser to check for errors
        self.sub_parser.parse_line(line, lineno)

    def parsetime(self, match):
        """Convert a string date into a datetime."""
        return datetime.datetime.strptime(match, self.DATE_FORMAT)

    def set_duration(self):
        """Sets duration for the step in seconds."""
        start = self.parsetime(self.current_step["started"])
        finish = self.parsetime(self.current_step["finished"])
        delta = finish - start
        self.current_step["duration"] = delta.total_seconds()

    @property
    def steps(self):
        """Return the list of steps in the artifact"""
        return self.artifact["steps"]

    @property
    def current_step(self):
        """Return the current step in the artifact"""
        return self.steps[self.stepnum]


class TinderboxPrintParser(ParserBase):

    RE_TINDERBOXPRINT = re.compile('^TinderboxPrint: (.*)$')

    def __init__(self):
        """Setup the artifact to hold the tinderbox print lines."""
        super(TinderboxPrintParser, self).__init__("tinderbox_printlines")

    def parse_line(self, line, lineno):
        """Parse a single line of the log"""
        match = self.RE_TINDERBOXPRINT.match(line)
        if match:
            self.artifact.append(match.group(1))


class ErrorParser(ParserBase):
    """A generic error detection sub-parser"""

    RE_INFO = re.compile("/TEST-(?:INFO|PASS) /")
    RE_ERR = re.compile((
        "(/TEST-UNEXPECTED-(?:PASS|FAIL) /)"
        "|(/^error: TEST FAILED/)"
        "|(/^g?make(?:\[\d+\])?: \*\*\*/)"
        "|(/fatal error/)"
        "|(/PROCESS-CRASH/)"
        "|(/Assertion failure:/)"
        "|(/Assertion failed:/)"
        "|(/###!!! ABORT:/)"
        "|(/ error\([0-9]*\):/)"
        "|(/ error R?C[0-9]*:/)"
        "|(/^\d+:\d+:\d+[ ]+(?:ERROR|CRITICAL|FATAL) - /)"
        "|(/^[A-Za-z]+Error:/)"
        "|(/^BaseException:/)"
        "|(/Automation Error:/)"
        "|(/Remote Device Error:/)"
        "|(/command timed out:/)"
        "|(/^remoteFailed:/)"
        "|(/^rm: cannot /)"
        "|(/^abort:/)"
        "|(/ERROR 503:/)"
        "|(/wget: unable /)"
        "|(/^Output exceeded \d+ bytes/)"
        "|(/^The web-page 'stop build' button was pressed/)"
    ))

    def __init__(self):
        """A simple error detection sub-parser"""
        super(ErrorParser, self).__init__("errors")

    def parse_line(self, line, lineno):
        """Check a single line for an error.  Keeps track of the linenumber"""
        if self.RE_ERR.match(line) and not self.RE_INFO.match(line):
            self.artifact.append({
                "linenumber": lineno,
                "line": line
            })
