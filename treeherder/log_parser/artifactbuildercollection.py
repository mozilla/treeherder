import requests
from contextlib import closing

from django.conf import settings

from .artifactbuilders import (BuildbotJobArtifactBuilder,
                               BuildbotLogViewArtifactBuilder,
                               BuildbotPerformanceDataArtifactBuilder)


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
        resp = requests.get(
            self.url,
            stream=True,
            headers={'User-Agent': settings.TREEHERDER_USER_AGENT},
            timeout=settings.REQUESTS_TIMEOUT
        )
        size_in_mb = int(resp.headers["content-length"]) / 1000000
        if size_in_mb > settings.MAX_LOG_SIZE:
            raise LogTooLargeException(
                "Log too large to parse: {}MB, Max: {}MB".format(
                    size_in_mb,
                    settings.MAX_LOG_SIZE
            ))

        with closing(resp) as lh:
            for line in lh.iter_lines():
                # run each parser on each line of the log
                for builder in self.builders:
                    builder.parse_line(line)

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


class LogTooLargeException(Exception):
    pass
