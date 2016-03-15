from jsonschema import validate

from treeherder.etl.perf import (PERFHERDER_SCHEMA,
                                 TALOS_SCHEMA)
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import (BuildbotPerformanceDataArtifactBuilder,
                                                    BuildbotTalosDataArtifactBuilder)

from ..sampledata import SampleData


def test_talos_log_parsing():
    """
    Make sure all performance data log examples validate with the
    talos json schema.
    """

    sd = SampleData()
    files = sd.get_talos_logs()

    for file_url in files:
        builder = BuildbotTalosDataArtifactBuilder(url=file_url)
        lpc = ArtifactBuilderCollection(file_url, builders=[builder])
        lpc.parse()
        act = lpc.artifacts[builder.name]

        # Validate the data returned has the required datazilla
        # json schema
        for talos_datum in act['talos_data']:
            validate(talos_datum, TALOS_SCHEMA)


def test_performance_log_parsing():
    """
    Validate that we can parse a generic performance artifact
    """
    sd = SampleData()

    # first two have only one artifact, second has two artifacts
    for (logfile, num_perf_artifacts) in [
            ('mozilla-inbound-android-api-11-debug-bm91-build1-build1317.txt.gz', 1),
            ('try_ubuntu64_hw_test-chromez-bm103-tests1-linux-build1429.txt.gz', 1),
            ('mozilla-inbound-linux64-bm72-build1-build225.txt.gz', 2)]:
        file_path = sd.get_log_path(logfile)
        file_url = 'file://{}'.format(file_path)

        builder = BuildbotPerformanceDataArtifactBuilder(url=file_url)
        lpc = ArtifactBuilderCollection(file_url, builders=[builder])
        lpc.parse()
        act = lpc.artifacts[builder.name]
        assert len(act['performance_data']) == num_perf_artifacts
        for perfherder_artifact in act['performance_data']:
            validate(perfherder_artifact, PERFHERDER_SCHEMA)
