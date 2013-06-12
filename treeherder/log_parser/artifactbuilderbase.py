import re


class ArtifactBuilderBase(object):
    """
    Base class for all Buildbot log parsers.

    The child class will be designed to create a particular type of artifact.

    This class is called for each line of the log file, so it has no
    knowledge of the log file itself, as a whole.  It only, optionally, has
    the url to the log file to add to its own artifact.

    """

    def __init__(self, job_type, url=None):
        """
        Create the LogParser

        ``job_type`` - Something like "mochitest" or "reftest", etc.
        ``url`` - The url this log comes from.  It's optional, but it gets
                  added to the artifact.
        """
        self.artifact = {
            "logurl": url
        }
        self.job_type = job_type
        self.lineno = 0
        self.parsers = []

    @property
    def name(self):
        """Return the name used to store this in the collection's artifact"""
        raise NotImplementedError  # pragma nocover

    def parse_line(self, line):
        """
        Parse a single line of the log.

        Parse the header until we hit a line with "started" in it.
        """

        for parser in self.parsers:
            if not parser.parse_complete:
                parser.parse_line(line, self.lineno)

            # match = self.RE_FINISH.match(line)
            # if match:
            #     self.artifact["header"]["finishtime"] = self.parsetime(
            #         match.group(2)).strftime("%s")
            # self.parse_content_line(line)

        self.lineno += 1

    def get_artifact(self):
        """
        Return the job artifact.

        A good place to update the artifact before returning it, if needed.
        This can be handy to get the "final duration" based on the
        last finished section.
        """
        for sp in self.parsers:
            self.artifact[sp.name] = sp.get_artifact()
        return self.artifact

    def parse_complete(self):
        """Whether or not all parsers are complete for this artifact."""
        if len(self.parsers):
            return all(x.parse_complete() for x in self.parsers)
        else:
            return False