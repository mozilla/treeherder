from datetime import datetime
import re

from .logparserbase import BuildbotLogParserBase


class BuildbotLogViewParser(BuildbotLogParserBase):
    """
    Makes the artifact for the log viewer.

    The stored object for a log will be
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

    def __init__(self, job_type, url=None):
        """
        Construct a ``BuildbotLogViewParser``

        Keep track of the current step number, and step artifacts

        Uses a simple ErrorParser to detect errors.  Error lines are added
        to each step they come from.
        """
        super(BuildbotLogViewParser, self).__init__(job_type, url)
        self.stepnum = -1
        self.artifact["steps"] = []
        self.sub_parser = ErrorParser()

    @property
    def name(self):
        """The name of this type of log artifact"""
        return "Structured Log"

    def parse_content_line(self, line):
        """Parse a single non-header line of the log"""

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
        self.sub_parser.parse_content_line(line, self.lineno)

    def set_duration(self):
        """Sets duration for the step in seconds."""
        f = "%Y-%m-%d %H:%M:%S.%f"
        start = datetime.strptime(self.current_step["started"], f)
        finish = datetime.strptime(self.current_step["finished"], f)
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


class ErrorParser(object):
    """
    Super simple parser to just find any line with an error or failure
    """

    def __init__(self):
        """A simple error detection sub-parser"""
        self.RE_ERR = re.compile(r".*?(TEST-UNEXPECTED-.*|PROCESS-CRASH) \| (.*)\|(.*)")
        self.errors = []

    def parse_content_line(self, line, lineno):
        """Check a single line for an error.  Keeps track of the linenumber"""
        if self.RE_ERR.match(line):
            self.errors.append({
                "linenumber": lineno,
                "line": line
            })

    def get_artifact(self):
        """Return the list of errors found, if any."""
        return self.errors