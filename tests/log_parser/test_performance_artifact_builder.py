import responses
from jsonschema import validate

from tests.test_utils import add_log_response
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotPerformanceDataArtifactBuilder
from treeherder.log_parser.utils import PERFHERDER_SCHEMA


@responses.activate
def test_performance_log_parsing():
    """
    Validate that we can parse a generic performance artifact
    """

    # first two have only one artifact, second has two artifacts
    for (logfile, num_perf_artifacts) in [
        ('mozilla-inbound-android-api-11-debug-bm91-build1-build1317.txt.gz', 1),
        ('try_ubuntu64_hw_test-chromez-bm103-tests1-linux-build1429.txt.gz', 1),
        ('mozilla-inbound-linux64-bm72-build1-build225.txt.gz', 2),
    ]:
        url = add_log_response(logfile)

        builder = BuildbotPerformanceDataArtifactBuilder(url=url)
        lpc = ArtifactBuilderCollection(url, builders=[builder])
        lpc.parse()
        act = lpc.artifacts[builder.name]
        assert len(act['performance_data']) == num_perf_artifacts
        for perfherder_artifact in act['performance_data']:
            validate(perfherder_artifact, PERFHERDER_SCHEMA)
