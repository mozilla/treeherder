import urllib2
import gzip
import io

from .logviewparser import BuildbotLogViewParser


class LogParseCollection(object):
    """
    Run a log through a collection of parsers to get artifacts.

    Result: Returns a list of log artifacts, one for each parser.

    Architecture
    ============

    LogParseCollection
    ------------------
        * Holds one or more instances of ``BuildbotLogParserBase``
        * If ``job_type`` passed in, creates the parser instances
        * If ``parsers`` passed in, uses those as the parsers
        * Reads the log from the log handle/url and walks each line
          calling into each parser with each line for handling
        * Maintains no state


    BuildbotLogParserBase
    -------------
        * Base class for all Buildbot log parsers.
        * Manages:
            * artifact
            * state
            * job_type
            * line number
        * Calls either ``parse_header_line`` or ``parse_content_line``
          depending on state
        * decides whether to call SubParser if in a step that matches
          the SubParser ``step_name_match`` regex.


    LogViewParser
    -------------
        * Parses out content for use in a visual Log Parser
        * Manages:
            * artifact steps (===started and ===finished lines)
            * current step number and count
            * sub_parser
        * Only SubParser here is an ErrorParser

    """

    def __init__(self, url, job_type=None, parsers=None):
        """
        ``url`` - url of the log to be parsed
        ``job_type`` - The type of job this log is for.
        ``parsers`` - LogViewParser instances that should
            be run against the log.

        Must provide either ``parsers`` or ``job_type`` so that
        default parsers can be created.
        """

        if not parsers and not job_type:
            raise ValueError("Must provide either ``job_type`` or ``parsers``")

        # the results
        self.url = url
        self.artifacts = {}
        self.job_type = job_type

        if parsers:
            # ensure that self.parsers is a list, even if a single parser was
            # passed in
            if not isinstance(parsers, list):
                parsers = [parsers]
            self.parsers = parsers
        else:
            # use the defaults
            self.parsers = [
                BuildbotLogViewParser(self.job_type, self.url),
            ]

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        return urllib2.urlopen(url)

    def parse(self):
        """
        Iterate over each line of the log, running each parser against it.

        Stream lines from the gzip file and run each parser against it,
        building the ``artifact`` as we go.

        """

        handle = self.get_log_handle(self.url)

        # using BytesIO is a workaround.  Apparently this is fixed in
        # Python 3.2, but not in the 2.x versions.  GzipFile wants the
        # the methods seek() and tell(), which don't exist on a normal
        # fileobj.
        # interesting write-up here:
        #     http://www.enricozini.org/2011/cazzeggio/python-gzip/
        gz_file = gzip.GzipFile(fileobj=io.BytesIO(handle.read()))

        for line in gz_file:
            # stop parsing if all parsers are done
            if not self.parse_complete:
                # run each parser on each line of the log
                for parser in self.parsers:
                    parser.parse_line(line)

        # gather the artifacts from all parsers
        for parser in self.parsers:
            self.artifacts[parser.name] = parser.get_artifact()

        gz_file.close()

    @property
    def parse_complete(self):
        """Return true if all parsers are parse_complete."""
        return all([x.parse_complete for x in self.parsers])
