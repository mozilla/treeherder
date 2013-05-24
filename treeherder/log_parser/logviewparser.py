from datetime import datetime
import re

from .logparserbase import LogParserBase
from .subparsers import SubParser


class LogViewerParser(LogParserBase):
    """
    Makes the artifact for the log viewer.

    Store the resulting artifact in the DB gzipped.  Then the client
    will uncompress in JS.

    The stored object for a log will be
        "steps": [
            {
                "name": "unittest"  # the name of the process on start line
                "order": 1          # the order the process came in the log file
                "errors": [],
                "error_count": 2,   # count of error lines
                "duration": 23.5,   # in minutes
                "started": "2013-05-13 10:27:56.012903",
                "finished": "2013-05-13 10:27:56.013766",
                "content": "text"
            },
            ...
        ]

    """

    def __init__(self, job_type):
        super(LogViewerParser, self).__init__(job_type)
        self.stepnum = -1
        self.artifact["steps"] = []
        self.sub_parser = SubParser.create(job_type)

    @property
    def name(self):
        """The name of this type of log"""
        return "Structured Log"

    def parse_content_line(self, line):
        """Parse a single line of the log"""

        match = self.RE_START.match(line)
        if match:
            self.state = self.ST_STARTED
            self.stepnum += 1
            self.steps.append({
                "name": match.group(1),
                "started": match.group(2),
                "content": line,
                "order": self.stepnum,
                "errors": [],
            })

            return

        match = self.RE_FINISH.match(line)
        if match:
            self.state = self.ST_FINISHED

            self.current_step.update({
                "finished": match.group(2),
            })
            self.set_duration()
            self.add_line(line)
            for sp in self.sub_parsers:
                self.current_step["errors"].append(sp.errors)
            self.sub_parsers = []
            self.current_step["error_count"] = len(self.current_step["errors"])
            return



        """
        Not sure about this:
            so far the sub-parsers parse out all the pieces, not just the
            one step.  I think I need to make the sub-parsers only act on the
            step that has the actual mochitest, reftest or whatever.

            so I may need to blend the SubParser and TestSuiteParser, unless
            TestSuiteParser and BuildLogParser need to be very different.  They
            may be the same except for the step we care about, in which case they
            SHOULD be merged because all the logs with the one-step of importance
            will be different.

            so I need to:
                * run the sub-parser only on the part or parts that it needs to. need a state for this?
                    might need to pass the filename in to constructor of the subparser: "name": "'/tools/buildbot/bin/python scripts/scripts/desktop_unittest.py ...'",
                * separate the logic out for only the step that counts
                * fix naming of vars to match
                * write to the artifact as it goes, not a bunch of values all over the place
                * return the artifact in a getter

        """









        if self.sub_parser:
            self.sub_parser.parse_content_line(line)

        # otherwise, just add the line to the content
        if self.state == self.ST_STARTED:
            self.add_line(line)

    def set_duration(self):
        """Sets duration for the step in seconds."""
        f = "%Y-%m-%d %H:%M:%S.%f"
        start = datetime.strptime(self.current_step["started"], f)
        finish = datetime.strptime(self.current_step["finished"], f)
        delta = finish - start
        self.current_step["duration"] = delta.total_seconds()

    def add_error_line(self, line):
        """Add this line to the list of errors of the current step"""
        self.current_step["errors"].append(line)

    def add_line(self, line):
        """Add this line to the content of the current step"""
        self.current_step["content"] += line

    @property
    def steps(self):
        """Return the list of steps in the artifact"""
        return self.artifact["steps"]

    @property
    def current_step(self):
        """Return the current step in the artifact"""
        return self.steps[self.stepnum]



class ErrorParser(object):

    def __init__(self):
        self.RE_ERR = re.compile("FAIL|ERROR")
        self.errors = []

    def parse_content_line(self, line):
        if self.RE_ERR.I(line):
            self.errors.append(line)