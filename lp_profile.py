from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotJobArtifactBuilder

fname = "mozilla-b2g18-macosx64-bm57-build1-build14.txt.gz"
url = "file:///home/vagrant/treeherder-service/tests/sample_data/logs/{0}".format(fname)

# builder = BuildbotJobArtifactBuilder(url)
abc = ArtifactBuilderCollection(url)
abc.parse()
