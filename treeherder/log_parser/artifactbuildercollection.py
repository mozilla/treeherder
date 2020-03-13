import logging

import newrelic.agent

from treeherder.utils.http import make_request

from .artifactbuilders import (BuildbotJobArtifactBuilder,
                               BuildbotLogViewArtifactBuilder,
                               BuildbotPerformanceDataArtifactBuilder)
from .parsers import EmptyPerformanceData

logger = logging.getLogger(__name__)
# Max log size in bytes we will download (prior to decompression).
MAX_DOWNLOAD_SIZE_IN_BYTES = 5 * 1024 * 1024


class ArtifactBuilderCollection:
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

        if builders:
            # ensure that self.builders is a list, even if a single parser was
            # passed in
            if not isinstance(builders, list):
                builders = [builders]
            self.builders = builders
        else:
            # use the defaults
            self.builders = [
                BuildbotLogViewArtifactBuilder(url=self.url),
                BuildbotJobArtifactBuilder(url=self.url),
                BuildbotPerformanceDataArtifactBuilder(url=self.url)
            ]

    def parse(self):
        """
        Iterate over each line of the log, running each parser against it.

        Stream lines from the gzip file and run each parser against it,
        building the ``artifact`` as we go.
        """
        with make_request(self.url, stream=True) as response:
            download_size_in_bytes = int(response.headers.get('Content-Length', -1))

            # Temporary annotation of log size to help set thresholds in bug 1295997.
            newrelic.agent.add_custom_parameter(
                'unstructured_log_size',
                download_size_in_bytes
            )
            newrelic.agent.add_custom_parameter(
                'unstructured_log_encoding',
                response.headers.get('Content-Encoding', 'None')
            )

            if download_size_in_bytes > MAX_DOWNLOAD_SIZE_IN_BYTES:
                raise LogSizeException('Download size of %i bytes exceeds limit' % download_size_in_bytes)

            # Lines must be explicitly decoded since `iter_lines()`` returns bytes by default
            # and we cannot use its `decode_unicode=True` mode, since otherwise Unicode newline
            # characters such as `\u0085` (which can appear in test output) are treated the same
            # as `\n` or `\r`, and so split into unwanted additional lines by `iter_lines()`.
            for line in response.iter_lines():
                for builder in self.builders:
                    try:
                        # Using `replace` to prevent malformed unicode (which might possibly exist
                        # in test message output) from breaking parsing of the rest of the log.
                        builder.parse_line(line.decode('utf-8', 'replace'))
                    except EmptyPerformanceData:
                        logger.warning("We have parsed an empty PERFHERDER_DATA for %s", self.url)

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


class LogSizeException(Exception):
    pass
