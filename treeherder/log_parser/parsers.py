# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import datetime
import json
import re

from django.conf import settings

from treeherder.etl.buildbot import RESULT_DICT


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
            "result": 0,
            "error_count": 0,
            "duration": 0.000699, # in seconds
            "order": 0  # the order the process came in the log file
        },
        ...
    ]
    """
    PATTERN = r' (?P<name>.*?) \(results: (?P<result_code>\d+), elapsed: .*?\) \(at (?P<timestamp>.*?)\)'
    RE_STEP_START = re.compile(r'={9} Started' + PATTERN)
    RE_STEP_FINISH = re.compile(r'={9} Finished' + PATTERN)
    STATES = {
        # The initial state until we record the first step.
        "awaiting_first_step": 0,
        # We've started a step, but not yet seen the end of it.
        "step_in_progress": 1,
        # We've seen the end of the previous step.
        "step_finished": 2,
    }
    # date format in a step started/finished header
    DATE_FORMAT = '%Y-%m-%d %H:%M:%S.%f'

    def __init__(self):
        """Setup the artifact to hold the header lines."""
        super(StepParser, self).__init__("step_data")
        self.stepnum = -1
        self.artifact = {
            "steps": [],
            "all_errors": [],
            "errors_truncated": False
        }
        self.sub_parser = ErrorParser()
        self.state = self.STATES['awaiting_first_step']

    def parse_line(self, line, lineno):
        """Parse a single non-header line of the log"""
        # Check if we're waiting for a step start line.
        if self.state != self.STATES['step_in_progress']:
            match = self.RE_STEP_START.match(line)
            if match:
                self.start_step(lineno,
                                name=match.group('name'),
                                timestamp=match.group('timestamp'))
            return

        # Check if it's the end of a step.
        match = self.RE_STEP_FINISH.match(line)
        if match:
            self.end_step(lineno,
                          timestamp=match.group('timestamp'),
                          result_code=int(match.group('result_code')))
            return

        # Otherwise just parse the line, since we're in the middle of a step.
        self.sub_parser.parse_line(line, lineno)

    def start_step(self, lineno, name="Unnamed step", timestamp=None):
        """Create a new step and update the state to reflect we're now in the middle of a step."""
        self.state = self.STATES['step_in_progress']
        self.stepnum += 1
        self.steps.append({
            "name": name,
            "started": timestamp,
            "started_linenumber": lineno,
            "order": self.stepnum,
            "errors": [],
        })

    def end_step(self, lineno, timestamp=None, result_code=None):
        """Fill in the current step's summary and update the state to show the current step has ended."""
        self.state = self.STATES['step_finished']
        step_errors = self.sub_parser.get_artifact()
        step_error_count = len(step_errors)
        if step_error_count > settings.PARSER_MAX_STEP_ERROR_LINES:
            step_errors = step_errors[:settings.PARSER_MAX_STEP_ERROR_LINES]
            self.artifact["errors_truncated"] = True
        self.current_step.update({
            "finished": timestamp,
            "finished_linenumber": lineno,
            "result": RESULT_DICT.get(result_code, "unknown"),
            "errors": step_errors,
            "error_count": step_error_count
        })
        self.set_duration()
        # Append errors from current step to "all_errors" field
        self.artifact["all_errors"].extend(step_errors)
        # reset the sub_parser for the next step
        self.sub_parser.clear()

    def parsetime(self, match):
        """Convert a string date into a datetime."""
        # DATE_FORMAT expects a decimal on the seconds.  If it's not
        # present, we must add it so the date parsing does not fail.
        if "." not in match:
            match = "{0}.0".format(match)
        return datetime.datetime.strptime(match, self.DATE_FORMAT)

    def set_duration(self):
        """Sets duration for the step in seconds."""
        start = self.parsetime(self.current_step["started"])
        finish = self.parsetime(self.current_step["finished"])
        td = finish - start
        secs = (
            td.microseconds + (td.seconds + td.days * 24 * 3600) * 10**6
        ) / 10.0**6
        self.current_step["duration"] = int(round(secs))

    @property
    def steps(self):
        """Return the list of steps in the artifact"""
        return self.artifact["steps"]

    @property
    def current_step(self):
        """Return the current step in the artifact"""
        return self.steps[self.stepnum]


class TinderboxPrintParser(ParserBase):

    RE_TINDERBOXPRINT = re.compile(r'.*TinderboxPrint: ?(?P<line>.*)$')

    RE_UPLOADED_TO = re.compile(
        r"<a href=['\"](?P<url>http(s)?://.*)['\"]>(?P<value>.+)</a>: uploaded"
    )
    RE_LINK_HTML = re.compile(
        (r"((?P<title>[A-Za-z/\.0-9\-_ ]+): )?"
         r"<a .*href=['\"](?P<url>http(s)?://.+)['\"].*>(?P<value>.+)</a>")
    )
    RE_LINK_TEXT = re.compile(
        r"((?P<title>[A-Za-z/\.0-9\-_ ]+): )?(?P<url>http(s)?://.*)"
    )

    TINDERBOX_REGEXP_TUPLE = (
        {
            're': RE_UPLOADED_TO,
            'base_dict': {
                "content_type": "link",
                "title": "artifact uploaded"
            },
            'duplicates_fields': {}
        },
        {
            're': RE_LINK_HTML,
            'base_dict': {
                "content_type": "link"
            },
            'duplicates_fields': {}
        },
        {
            're': RE_LINK_TEXT,
            'base_dict': {
                "content_type": "link"
            },
            'duplicates_fields': {'value': 'url'}
        }
    )

    def __init__(self):
        """Setup the artifact to hold the job details."""
        super(TinderboxPrintParser, self).__init__("job_details")

    def parse_line(self, line, lineno):
        """Parse a single line of the log"""
        match = self.RE_TINDERBOXPRINT.match(line) if line else None
        if match:
            line = match.group('line')

            if line.startswith("TalosResult: "):
                title, json_value = line.split(": ", 1)

                self.artifact.append({
                    "title": title,
                    "content_type": "TalosResult",
                    "value": json.loads(json_value)
                })
                return

            for regexp_item in self.TINDERBOX_REGEXP_TUPLE:
                match = regexp_item['re'].match(line)
                if match:
                    artifact = match.groupdict()
                    # handle duplicate fields
                    for to_field, from_field in regexp_item['duplicates_fields'].items():
                        # if to_field not present or None copy form from_field
                        if to_field not in artifact or artifact[to_field] is None:
                            artifact[to_field] = artifact[from_field]
                    artifact.update(regexp_item['base_dict'])
                    self.artifact.append(artifact)
                    return

            # default case: consider it html content
            # try to detect title/value splitting on <br/>
            artifact = {"content_type": "raw_html", }
            if "<br/>" in line:
                title, value = line.split("<br/>", 1)
                artifact["title"] = title
                artifact["value"] = value
            else:
                artifact["value"] = line
            self.artifact.append(artifact)


class ErrorParser(ParserBase):
    """A generic error detection sub-parser"""

    IN_SEARCH_TERMS = (
        "TEST-UNEXPECTED-",
        "fatal error",
        "FATAL ERROR",
        "PROCESS-CRASH",
        "Assertion failure:",
        "Assertion failed:",
        "###!!! ABORT:",
        "E/GeckoLinker",
        "SUMMARY: AddressSanitizer",
        "SUMMARY: LeakSanitizer",
        "Automation Error:",
        "command timed out:",
        "wget: unable ",
    )

    RE_ERR_MATCH = re.compile((
        r"^error: TEST FAILED"
        r"|^g?make(?:\[\d+\])?: \*\*\*"
        r"|^Remote Device Error:"
        r"|^[A-Za-z.]+Error: "
        r"|^[A-Za-z.]*Exception: "
        r"|^remoteFailed:"
        r"|^rm: cannot "
        r"|^abort:"
        r"|^Output exceeded \d+ bytes"
        r"|^The web-page 'stop build' button was pressed"
        r"|.*\.js: line \d+, col \d+, Error -"
        r"|^\[taskcluster\] Error:"
    ))

    RE_ERR_SEARCH = re.compile((
        r" error\(\d*\):"
        r"|:\d+: error:"
        r"| error R?C\d*:"
        r"|ERROR [45]\d\d:"
        r"|mozmake\.exe(?:\[\d+\])?: \*\*\*"
    ))

    RE_EXCLUDE_1_SEARCH = re.compile(r"TEST-(?:INFO|PASS) ")

    RE_EXCLUDE_2_SEARCH = re.compile(
        r"I[ /](Gecko|Robocop|TestRunner).*TEST-UNEXPECTED-"
        r"|^TimeoutException: "
        r"|^ImportError: No module named pygtk$"
        )

    RE_ERR_1_MATCH = re.compile(r"^\d+:\d+:\d+ +(?:ERROR|CRITICAL|FATAL) - ")

    RE_MOZHARNESS_PREFIX = re.compile(r"^\d+:\d+:\d+ +(?:DEBUG|INFO|WARNING) - +")

    def __init__(self):
        """A simple error detection sub-parser"""
        super(ErrorParser, self).__init__("errors")

    def add(self, line, lineno):
        self.artifact.append({
            "linenumber": lineno,
            "line": line.rstrip()
        })

    def parse_line(self, line, lineno):
        """Check a single line for an error.  Keeps track of the linenumber"""
        if self.is_error_line(line):
            self.add(line, lineno)

    def is_error_line(self, line):
        if self.RE_EXCLUDE_1_SEARCH.search(line):
            return False

        if self.RE_ERR_1_MATCH.match(line):
            return True

        # Remove mozharness prefixes prior to matching
        trimline = re.sub(self.RE_MOZHARNESS_PREFIX, "", line)

        if self.RE_EXCLUDE_2_SEARCH.search(trimline):
            return False

        return bool(any(term for term in self.IN_SEARCH_TERMS if term in trimline) or
                    self.RE_ERR_MATCH.match(trimline) or self.RE_ERR_SEARCH.search(trimline))


class TalosParser(ParserBase):
    """a sub-parser to find TALOSDATA"""

    # Using $ in the regex as an end of line bounds causes the
    # regex to fail on windows logs. This is likely due to the
    # ^M character representation of the windows end of line.
    RE_TALOSDATA = re.compile(r'.*?TALOSDATA:\s+(\[.*\])')

    def __init__(self):
        super(TalosParser, self).__init__("talos_data")

    def parse_line(self, line, lineno):
        """check each line for TALOSDATA"""

        match = self.RE_TALOSDATA.match(line)
        if match:
            # this will throw an exception if the json parsing breaks, but
            # that's the behaviour we want
            self.artifact = json.loads(match.group(1))
            # Mark this parser as complete, so we don't continue to run
            # it against every remaining line in the log.
            self.complete = True
