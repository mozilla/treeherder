import io
import urllib2
import zlib
from contextlib import closing

from django.conf import settings

from .artifactbuilders import (BuildbotJobArtifactBuilder,
                               BuildbotLogViewArtifactBuilder,
                               BuildbotPerformanceDataArtifactBuilder)

DEFAULT_BUILDERS = [BuildbotLogViewArtifactBuilder,
                    BuildbotJobArtifactBuilder,
                    BuildbotPerformanceDataArtifactBuilder]


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
* parser
* Passes lines the ``Parser``

BuildbotLogViewArtifactBuilder
-------------
* Parses out content for use in a visual Log Parser
* Parsers:
* StepParser, which has its own ErrorParser

BuildbotJobArtifactBuilder
-------------
* Builds an artifact for the Treeherder job details panel
* Parsers:
* TinderboxPrintParser

BuildbotPerformanceDataArtifactBuilder
-------------
* Builds an artifact from performance data
* Parsers:
* PerformanceParser
"""

    def __init__(self, url, builders=None):
        """
        ``url`` - url of the log to be parsed
        ``builders`` - ArtifactBuilder instances to generate artifacts.
        In omitted, use defaults.

        """

        self.url = url
        self.artifacts = {}

        self.builders = []
        if builders:
            # ensure that self.builders is a list, even if a single parser was
            # passed in
            if not isinstance(builders, list):
                builders = [builders]
        else:
            builders = DEFAULT_BUILDERS

        for builder_cls in builders:
            builder = builder_cls(self.url)
            self.builders.append(builder)

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        req = urllib2.Request(url)
        req.add_header('User-Agent', settings.TREEHERDER_USER_AGENT)
        return urllib2.urlopen(
           req,
           timeout=settings.REQUESTS_TIMEOUT
        )

    def parse(self):
        """
        Iterate over each line of the log, running each parser against it.

        Stream lines from the gzip file and run each parser against it,
        building the ``artifact`` as we go.
        """
        with closing(self.get_log_handle(self.url)) as lh:

            def _parse_lines(f, readpos, end=False):
                f.seek(readpos)
                for line in f:
                    if '\n' not in line and not end:
                        return f.tell() - len(line)
                    # run each parser on each line of the log
                    for builder in self.builders:
                        builder.parse_line(line)

                return f.tell()

            # decompress the gzip file and process lines while we're downloading
            # We can't just use GzipFile, because that wants the
            # methods seek() and tell(), which don't exist on a normal
            # fileobj (at least in Python 2.x, apparently it does in Python 3.2).
            # interesting write-up here:
            # http://www.enricozini.org/2011/cazzeggio/python-gzip/

            GZIP_WINDOW_SIZE = 16 + zlib.MAX_WBITS  # zlib window size for gzip
            zipobj = zlib.decompressobj(GZIP_WINDOW_SIZE)
            with closing(io.BytesIO()) as f:
                readpos = 0
                while True:
                    bytes = lh.read(4096)
                    if not bytes:
                        f.write(zipobj.flush())
                        _parse_lines(f, readpos, end=True)
                        break
                    else:
                        f.write(zipobj.decompress(bytes))
                        readpos = _parse_lines(f, readpos)
                        f.seek(0, 2)

        # gather the artifacts from all builders
        for builder in self.builders:
            # Run end-of-parsing actions for this parser,
            # in case the artifact needs clean-up/summarising.
            builder.finish_parse()
            name = builder.name
            artifact = builder.get_artifact()
            if name == 'performance_data' and not artifact[name]:
                continue
            self.artifacts[name] = artifact
