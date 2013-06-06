from datetime import datetime
import re

from .logparserbase import LogParserBase


class LogViewParser(LogParserBase):
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
        super(LogViewParser, self).__init__(job_type)
        self.stepnum = -1
        self.artifact["steps"] = []
        self.sub_parser = ErrorParser()

    @property
    def name(self):
        """The name of this type of log"""
        return "Structured Log"

    def parse_content_line(self, line):
        """Parse a single line of the log"""

        # check if it's the start of a step
        match = self.RE_START.match(line)
        if match:
            self.state = self.ST_STARTED
            self.stepnum += 1
            self.steps.append({
                "name": match.group(1),
                "started": match.group(2),
                "started_linenumber": self.lineno,
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
                "finished_linenumber": self.lineno,
                "errors": self.sub_parser.get_artifact(),
            })
            self.set_duration()
            self.current_step["error_count"] = len(self.current_step["errors"])

            # reset the sub_parser for the next step
            self.sub_parser = ErrorParser()
            return

        # call the subparser to check for errors
        self.sub_parser.parse_content_line(line)

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

    @property
    def steps(self):
        """Return the list of steps in the artifact"""
        return self.artifact["steps"]

    @property
    def current_step(self):
        """Return the current step in the artifact"""
        return self.steps[self.stepnum]


class ErrorParser(object):
    """
    Super simple parser to just find any line with an error or failure
    """

    def __init__(self):
        # self.RE_ERR = re.compile(".*?(UNEXPECTED-FAIL|UNEXPECTED-ERROR).*?")
        self.RE_ERR = re.compile(r".*?(TEST-UNEXPECTED-.*|PROCESS-CRASH) \| (.*)\|(.*)")
        self.errors = []

    def parse_content_line(self, line):
        if self.RE_ERR.match(line):
            self.errors.append(line)

    def get_artifact(self):
        return self.errors