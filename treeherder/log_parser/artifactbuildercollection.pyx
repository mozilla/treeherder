# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

import urllib2
import gzip
import io
from contextlib import closing
from django.conf import settings

from .artifactbuilders import (BuildbotLogViewArtifactBuilder,
                               BuildbotJobArtifactBuilder,
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
* parsers
* Passes lines into each ``Parser``

BuildbotLogViewArtifactBuilder
-------------
* Parses out content for use in a visual Log Parser
* Parsers:
* StepParser, which has its own ErrorParser

BuildbotJobArtifactBuilder
-------------
* Builds an artifact for the Treeherder job details panel
* Parsers:
* ErrorParser
* TinderboxPrintParser

BuildbotPerformanceDataArtifactBuilder
-------------
* Builds an artifact from talos data
* Parsers:
* TalosParser
"""

    def __init__(self, url, builders=None, check_errors=True):
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
                BuildbotLogViewArtifactBuilder(
                    url=self.url,
                    check_errors=check_errors,
                    ),
                BuildbotJobArtifactBuilder(self.url),
                BuildbotPerformanceDataArtifactBuilder(self.url)
            ]

    def get_log_handle(self, url):
        """Hook to get a handle to the log with this url"""
        return urllib2.urlopen(
               url,
               timeout=settings.TREEHERDER_REQUESTS_TIMEOUT
        )

    def parse(self):
        """
        Iterate over each line of the log, running each parser against it.

        Stream lines from the gzip file and run each parser against it,
        building the ``artifact`` as we go.

        """

        handle = None
        gz_file = None
        with closing(self.get_log_handle(self.url)) as handle:

            # using BytesIO is a workaround. Apparently this is fixed in
            # Python 3.2, but not in the 2.x versions. GzipFile wants the
            # methods seek() and tell(), which don't exist on a normal
            # fileobj.
            # interesting write-up here:
            # http://www.enricozini.org/2011/cazzeggio/python-gzip/
            with closing(gzip.GzipFile(fileobj=io.BytesIO(handle.read()))) as gz_file:
                for line in gz_file:
                    # run each parser on each line of the log
                    for builder in self.builders:
                        builder.parse_line(line)

                # gather the artifacts from all builders
                for builder in self.builders:
                    artifact = builder.get_artifact()
                    if builder.name == 'talos_data':
                        if len(artifact[builder.name]) > 0:
                            self.artifacts[builder.name] = artifact
                    else:
                        self.artifacts[builder.name] = artifact
