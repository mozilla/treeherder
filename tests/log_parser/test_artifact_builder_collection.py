# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from treeherder.log_parser.artifactbuildercollection import ArtifactBuilderCollection
from treeherder.log_parser.artifactbuilders import BuildbotLogViewArtifactBuilder
from ..sampledata import SampleData
from datadiff import diff


def test_builders_as_list():
    """test that passing in a list of builders works"""
    builder = BuildbotLogViewArtifactBuilder()
    lpc = ArtifactBuilderCollection(
        "foo-url",
        builders=[builder]
    )
    assert lpc.builders == [builder]


def test_builders_as_single_still_list():
    """test that passing in a single builder becomes a list"""
    builder = BuildbotLogViewArtifactBuilder()
    lpc = ArtifactBuilderCollection(
        "foo-url",
        builders=builder
    )
    assert lpc.builders == [builder]


def test_default_builders():
    """test no builders"""
    lpc = ArtifactBuilderCollection(
        "foo-url",
    )
    assert isinstance(lpc.builders, list)
    assert len(lpc.builders) == 3


def test_check_errors_false():
    """test for check errors disabled case"""
    abc = ArtifactBuilderCollection(
        "foo-url",
        check_errors=False
    )

    assert abc.builders[0].parsers[1].check_errors is False


def test_all_builders_complete():
    """test when parse.complete is true creates correct structure"""
    log = "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    url = "file://{0}".format(
        SampleData().get_log_path("{0}.txt.gz".format(log)))
    lpc = ArtifactBuilderCollection(
        url,
    )
    for builder in lpc.builders:
        for parser in builder.parsers:
            parser.complete = True

    lpc.parse()
    exp = {
        "Structured Log": {
            "header": {},
            "step_data": {
                "all_errors": [],
                "steps": []
            },
        },
        "Job Info": {
            "job_details": []
        }
    }
    act = lpc.artifacts

    # we can't compare the "logurl" field, because it's a fully qualified url,
    # so it will be different depending on the config it's run in.
    assert "logurl" in act["Structured Log"]
    assert "logurl" in act["Job Info"]
    del(act["Job Info"]["logurl"])
    del(act["Structured Log"]["logurl"])

    assert exp == lpc.artifacts, diff(exp, lpc.artifacts)
