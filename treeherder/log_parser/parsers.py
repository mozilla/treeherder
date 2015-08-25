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

    def finish_parse(self, last_lineno_seen):
        """Clean-up/summary tasks run at the end of parsing."""
        pass

    def get_artifact(self):
        """By default, just return the artifact as-is."""
        return self.artifact


class StepParser(ParserBase):
    """
    Parse out individual job steps within a log.

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
    # Matches the half-dozen 'key: value' header lines printed at the start of each
    # Buildbot job log. The list of keys are taken from:
    # https://hg.mozilla.org/build/buildbotcustom/file/644c3860300a/bin/log_uploader.py#l126
    RE_HEADER_LINE = re.compile(r'(?:builder|slave|starttime|results|buildid|builduid|revision): .*')
    # Step marker lines, eg:
    # ========= Started foo (results: 0, elapsed: 0 secs) (at 2015-08-17 02:33:56.353866) =========
    # ========= Finished foo (results: 0, elapsed: 0 secs) (at 2015-08-17 02:33:56.354301) =========
    RE_STEP_MARKER = re.compile(r'={9} (?P<marker_type>Started|Finished) (?P<name>.*?) '
                                r'\(results: (?P<result_code>\d+), elapsed: .*?\) '
                                r'\(at (?P<timestamp>.*?)\)')
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
        """Parse a single line of the log.

        We have to handle both buildbot style logs as well as Taskcluster logs. The latter
        attempt to emulate the buildbot logs, but don't accurately do so, partly due
        to the way logs are generated in Taskcluster (ie: on the workers themselves).

        Buildbot logs:

            builder: ...
            slave: ...
            starttime: ...
            results: ...
            buildid: ...
            builduid: ...
            revision: ...

            ======= <step START marker> =======
            <step log output>
            ======= <step FINISH marker> =======

            ======= <step START marker> =======
            <step log output>
            ======= <step FINISH marker> =======

        Taskcluster logs (a worst-case example):

            <log output outside a step>
            ======= <step START marker> =======
            <step log output>
            ======= <step FINISH marker> =======
            <log output outside a step>
            ======= <step START marker> =======
            <step log output with no following finish marker>

        As can be seen above, Taskcluster logs can have (a) log output that falls between
        step markers, and (b) content at the end of the log, that is not followed by a
        final finish step marker. We handle this by creating generic placeholder steps to
        hold the log output that is not enclosed by step markers, and then by cleaning up
        the final step in finish_parse() once all lines have been parsed.
        """
        if not line.strip():
            # Skip whitespace-only lines, since they will never contain an error line,
            # so are not of interest. This also avoids creating spurious unnamed steps
            # (which occurs when we find content outside of step markers) for the
            # newlines that separate the steps in Buildbot logs.
            return

        if self.state == self.STATES['awaiting_first_step'] and self.RE_HEADER_LINE.match(line):
            # The "key: value" job metadata header lines that appear at the top of
            # Buildbot logs would result in the creation of an unnamed step at the
            # start of the job, unless we skip them. (Which is not desired, since
            # the lines are metadata and not test/build output.)
            return

        step_marker_match = self.RE_STEP_MARKER.match(line)

        if not step_marker_match:
            # This is a normal log line, rather than a step marker. (The common case.)
            if self.state != self.STATES['step_in_progress']:
                # We don't have an in-progress step, so need to start one, even though this
                # isn't a "step started" marker line. We therefore create a new generic step,
                # since we have no way of finding out the step metadata. This case occurs
                # for the Taskcluster logs where content can fall between step markers.
                self.start_step(lineno)
            # Parse the line for errors, which if found, will be associated with the current step.
            self.sub_parser.parse_line(line, lineno)
            return

        # This is either a "step started" or "step finished" marker line, eg:
        # ========= Started foo (results: 0, elapsed: 0 secs) (at 2015-08-17 02:33:56.353866) =========
        # ========= Finished foo (results: 0, elapsed: 0 secs) (at 2015-08-17 02:33:56.354301) =========

        if step_marker_match.group('marker_type') == 'Started':
            if self.state == self.STATES['step_in_progress']:
                # We're partway through a step (ie: haven't seen a "step finished" marker line),
                # but have now reached the "step started" marker for the next step. Before we
                # can start the new step, we have to clean up the previous one - albeit using
                # generic step metadata, since there was no "step finished" marker. This occurs
                # in Taskcluster's logs when content falls between the step marker lines.
                self.end_step(lineno)
            # Start a new step using the extracted step metadata.
            self.start_step(lineno,
                            name=step_marker_match.group('name'),
                            timestamp=step_marker_match.group('timestamp'))
            return

        # This is a "step finished" marker line.

        if self.state != self.STATES['step_in_progress']:
            # We're not in the middle of a step, so can't finish one. Just ignore the marker line.
            return

        # Close out the current step using the extracted step metadata.
        self.end_step(lineno,
                      timestamp=step_marker_match.group('timestamp'),
                      result_code=int(step_marker_match.group('result_code')))

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
            # Whilst the result code is present on both the start and end buildbot-style step
            # markers, for Taskcluster logs the start marker line lies about the result, since
            # the log output is unbuffered, so Taskcluster does not know the real result at
            # that point. As such, we only set the result when ending a step.
            "result": RESULT_DICT.get(result_code, "unknown"),
            "errors": step_errors,
            "error_count": step_error_count
        })
        self.set_duration()
        # Append errors from current step to "all_errors" field
        self.artifact["all_errors"].extend(step_errors)
        # reset the sub_parser for the next step
        self.sub_parser.clear()

    def finish_parse(self, last_lineno_seen):
        """Clean-up/summary tasks run at the end of parsing."""
        if self.state == self.STATES['step_in_progress']:
            # We've reached the end of the log without seeing the final "step finish"
            # marker, which would normally have triggered updating the step. As such we
            # must manually close out the current step, so things like all_errors,
            # result, finish time and duration are set for it. This ensures that the
            # error summary for Taskcluster infra failures actually lists the error
            # that occurs at the end of the log.
            self.end_step(last_lineno_seen)

    def parsetime(self, match):
        """Convert a string date into a datetime."""
        # DATE_FORMAT expects a decimal on the seconds.  If it's not
        # present, we must add it so the date parsing does not fail.
        if "." not in match:
            match = "{0}.0".format(match)
        return datetime.datetime.strptime(match, self.DATE_FORMAT)

    def set_duration(self):
        """Sets duration for the step in seconds."""
        started_string = self.current_step["started"]
        finished_string = self.current_step["finished"]
        if not (started_string and finished_string):
            # Handle the dummy steps (created to hold Taskcluster log content that
            # is between step markers), which have no recorded start/finish time.
            self.current_step["duration"] = None
            return
        start_time = self.parsetime(started_string)
        finish_time = self.parsetime(finished_string)
        td = finish_time - start_time
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
        r"|^\[[\w-]+:(?:error|exception)+\]"
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
