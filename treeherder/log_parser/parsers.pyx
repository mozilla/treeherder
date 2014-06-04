import re
import datetime
import json


class ParserBase(object):
    """
    Base class for all parsers.

    """
    def __init__(self, name):
        """Setup the artifact to hold the extracted data."""
        self.name = name
        self.clear()

    def clear(self):
        """Reset this parser's values for another run."""
        self.artifact = []
        self.complete = False

    def parse_line(self, line, lineno):
        """Parse a single line of the log"""
        raise NotImplementedError  # pragma no cover

    def get_artifact(self):
        """By default, just return the artifact as-is."""
        return self.artifact


RE_HEADER_VALUE = re.compile('^(?P<key>[a-z]+): (?P<value>.*)$')
RE_HEADER_START = re.compile("={9} Started (.*)$")


class HeaderParser(ParserBase):

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
        if RE_HEADER_START.match(line):
            self.complete = True
        else:
            match = RE_HEADER_VALUE.match(line)
            if match:
                key, value = match.groups()
                self.artifact[key] = value


PATTERN = (" (.*?) \(results: \d+, elapsed: (?:\d+ mins, )?\d+ secs\) "
               "\(at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}.\d+)\) ={9}")
RE_STEP_START = re.compile('={9} Started' + PATTERN)
RE_STEP_FINISH = re.compile('={9} Finished' + PATTERN)


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

    def __init__(self, check_errors=True):
        """Setup the artifact to hold the header lines."""
        super(StepParser, self).__init__("step_data")
        self.stepnum = -1
        self.artifact = {
            "steps": [],
            "all_errors": []
        }
        self.check_errors = check_errors
        # even if ``check_errors`` is false, we still want to instantiate
        # the ErrorParser because we rely on the artifact to contain its
        # results.  We will just skip calling it to parse.  Then it will create
        # all the right empty fields we expect.
        self.sub_parser = ErrorParser()
        self.state = None

    def parse_line(self, line, lineno):
        """Parse a single non-header line of the log"""

        # check if it's the start of a step
        if not self.state == self.ST_STARTED:
            match = RE_STEP_START.match(line)
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
        if self.state == self.ST_STARTED:
            match = RE_STEP_FINISH.match(line)
            if match:
                self.state = self.ST_FINISHED

                self.current_step.update({
                    "finished": match.group(2),
                    "finished_linenumber": lineno,
                    "errors": self.sub_parser.get_artifact(),
                })
                self.set_duration()
                # Append errors from current step to "all_errors" field
                self.artifact["all_errors"].extend(
                    self.sub_parser.get_artifact())
                self.current_step["error_count"] = len(
                    self.current_step["errors"])

                # reset the sub_parser for the next step
                self.sub_parser.clear()
                return
            if self.check_errors:
                self.sub_parser.parse_line(line, lineno)

    def parsetime(self, match):
        """Convert a string date into a datetime."""
        return datetime.datetime.strptime(match, self.DATE_FORMAT)

    def set_duration(self):
        """Sets duration for the step in seconds."""
        start = self.parsetime(self.current_step["started"])
        finish = self.parsetime(self.current_step["finished"])
        td = finish - start
        secs = (
            td.microseconds + (td.seconds + td.days * 24 * 3600) * 10**6
        ) / 10.0**6
        self.current_step["duration"] = secs

    @property
    def steps(self):
        """Return the list of steps in the artifact"""
        return self.artifact["steps"]

    @property
    def current_step(self):
        """Return the current step in the artifact"""
        return self.steps[self.stepnum]


RE_TINDERBOXPRINT = re.compile('.*?TinderboxPrint: (.*)$')


class TinderboxPrintParser(ParserBase):

    def __init__(self):
        """Setup the artifact to hold the tinderbox print lines."""
        super(TinderboxPrintParser, self).__init__("tinderbox_printlines")

    def parse_line(self, line, lineno):
        """Parse a single line of the log"""
        if "TinderboxPrint: " in line:
            match = RE_TINDERBOXPRINT.match(line)
            if match:
                self.artifact.append(match.group(1))


RE_INFO = re.compile((
        "^\d+:\d+:\d+[ ]+(?:INFO)(?: -  )"
        "(TEST-|INFO TEST-)(INFO|PASS|START|END) "
    ))


IN_SEARCH_TERMS = (
    "TEST-UNEXPECTED-PASS ",
    "TEST-UNEXPECTED-FAIL ",
    "TEST-TIMEOUT",
    "fatal error",
    "PROCESS-CRASH",
    "Assertion failure:",
    "Assertion failed:",
    "###!!! ABORT:",
    "Automation Error:",
    "Remote Device Error:",
    "command timed out:",
    "ERROR 503:",
    "wget: unable ",
)

RE_ERR_MATCH = re.compile((
    "^error: TEST FAILED"
    "|^g?make(?:\[\d+\])?: \*\*\*"
    "|^\d+:\d+:\d+[ ]+(?:ERROR|CRITICAL|FATAL) - "
    "|^[A-Za-z]+Error:"
    "|^Output exceeded \d+ bytes"
    "|^BaseException:"
    "|^remoteFailed:"
    "|^rm: cannot "
    "|^abort:"
    "|^The web-page 'stop build' button was pressed"
))


RE_ERR_SEARCH = re.compile((
    " error\([0-9]*\):"
    "| error R?C[0-9]*:"
))


class ErrorParser(ParserBase):
    """A generic error detection sub-parser"""

    def __init__(self):
        """A simple error detection sub-parser"""
        super(ErrorParser, self).__init__("errors")

    def parse_line(self, line, lineno):
        """Check a single line for an error.  Keeps track of the linenumber"""
        if not RE_INFO.match(line):
            if any(term for term in IN_SEARCH_TERMS if term in line) or \
                    RE_ERR_MATCH.match(line) or RE_ERR_SEARCH.search(line):
                self.artifact.append({
                    "linenumber": lineno,
                    "line": line.rstrip()
                })

RE_TALOSDATA = re.compile('.*?TALOSDATA: (\[.*\])$')

class TalosParser(ParserBase):
    """a sub-parser to find TALOSDATA"""

    def __init__(self):
        super(TalosParser, self).__init__("talos_data")

    def parse_line(self, line, lineno):
        """check each line for TALOSDATA"""

        match = RE_TALOSDATA.match(line)
        if "TALOSDATA: " in line and match:
            try:
                self.artifact = json.loads(match.group(1))
            except ValueError, e:
                self.artifact.append(match.group(1))