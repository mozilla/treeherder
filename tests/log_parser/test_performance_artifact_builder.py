from jsonschema import validate

from treeherder.etl.perf_data_adapters import TalosDataAdapter
from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotPerformanceDataArtifactBuilder

from ..sampledata import SampleData


def test_performance_log_parsing():
    """
    Make sure all performance data log examples validate with the
    datazilla json schema.
    """

    sd = SampleData()
    files = sd.get_performance_logs()

    tda = TalosDataAdapter()

    for file_url in files:
        builder = BuildbotPerformanceDataArtifactBuilder(url=file_url)
        lpc = ArtifactBuilderCollection(file_url, builders=[builder])
        lpc.parse()
        act = lpc.artifacts[builder.name]

        # Validate the data returned has the required datazilla
        # json schema
        for talos_datum in act['talos_data']:
            validate(talos_datum, tda.datazilla_schema)
