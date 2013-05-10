#import treeherder.log_splitter


class LogParseManager(object):
    """
    Create a metadata object for all logs of a given ``Job``.

    Given a ``job_id``, gathers all the logs for the given job,
    figures out which parser should be used for that log and
    gathers the results of parsing each one in a metadata object.

    If a log contains another type of log, this figures that out and
    calls the sub-parsers as well.

    Result: Returns a log-metadata artifact object for the UI.

    """

    def __init__(self, job_id):
        # the Table of Contents metadata object
        self.toc = {}
        self.job_id = job_id

    def get_log_list(self):
        """
        Inspect Job and return a list of logs that need parsing.

        Returns a list of objects like:
            {
                "url": "http...",
                "parser": MochitestParser,

            }

        """

        # @@@ Todo: LookFigure out the type for each log
        pass

    def parse_logs(self, log_list):
        """
        Walk the list of logs and parse each one, building the
        ``log-metadata`` object as we go.
        """
        logs = self.get_log_list()
        for log in logs:
            self.toc[log.name] = log.parse()


class LogParserBase(object):
    """
    Base class for all log parsers.

    Given a log, parse it and generate a meta-data object as a
    Table of Contents for the log.

    @@@ Child logs may also need parsing.

    """

    def __init__(self, log_url, name):
        # the url of the log to be parsed
        self.log_url = log_url
        # @@@ should we get ``name`` from the splitter or parser instead
        # of passing it in?
        self.name = name
        self.metadata = {}

    def process(self):
        """
        Main entry point to process this log: split it and parse it.
        """
        self.split()
        self.parse()
        return self.metadata

    def split(self):
        """
        Split up the log to its parts.  Most won't need real parsing,
        but there will be a "main" section that does.

        call the log_splitter from swatinem
        store the valuable parts in self.log_meta where appropriate

        """
        pass

    def parse(self):
        """
        Parse the log at this url and return the metadata object for
        this one log.  A job may have several of these.

        @@@ how do we handle if there's a log in a log?

        Implemented by the child class.

        """
        raise NotImplementedError("Need implementation for this parser class.")
