import urllib2
import gzip
import io

from .artifactbuilders import (BuildbotLogViewArtifactBuilder,
                               BuildbotJobArtifactBuilder)


class ArtifactBuilderCollection(object):
    """
    Run a log through a collection of Artifact Builders to generate artifacts.


    Architecture
    ============

    ArtifactBuilderCollection
    ------------------
        * Holds one or more instances of ``ArtifactBuilderBase``
        * If ``builders`` passed in, uses those as the artifact
          builders, otherwise creates the default artifact builders.
        * Reads the log from the log handle/url and walks each line
          calling into each artifact builder with each line for handling
        * Maintains no state


    ArtifactBuilderBase
    -------------
        * Base class for all artifact builders`.
        * Manages:
            * artifact
            * line number
            * parsers
        * Passes lines into each ``Parser``

    BuildbotLogViewArtifactBuilder
    -------------
        * Parses out content for use in a visual Log Parser
        * Parsers:
            * StepParser, which has its own ErrorParser

    BuildbotJobArtifactBuilder
    -------------
        * Builds an artifact for the TBPL main UI panel
        * Parsers:
            * ErrorParser
            * TinderboxPrintParser
    """

    def __init__(self, url, builders=None):
        """
        ``url`` - url of the log to be parsed
        ``builders`` - ArtifactBuilder instances to generate artifacts.
                       In omitted, use defaults.

        """

        self.url = url
        self.artifacts = {}

        if builders:
            # ensure that self.builders is a list, even if a single parser was
            # passed in
            if not isinstance(builders, list):
                builders = [builders]
            self.builders = builders
        else:
            # use the defaults
            self.builders = [
                BuildbotLogViewArtifactBuilder(self.url),
                BuildbotJobArtifactBuilder(self.url)
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
            # stop parsing if all builders are done
            if not self.complete:
                # run each parser on each line of the log
                for parser in self.builders:
                    parser.parse_line(line)

        # gather the artifacts from all builders
        for parser in self.builders:
            self.artifacts[parser.name] = parser.get_artifact()

        gz_file.close()

    @property
    def complete(self):
        """Return true if all builders are parse_complete."""
        return all([x.complete for x in self.builders])
