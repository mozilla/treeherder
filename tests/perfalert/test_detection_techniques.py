from types import SimpleNamespace

import mozdetect
import pytest

from treeherder.perf.detection_techniques import (
    TECHNIQUE_PRESETS,
    TTEST,
    DetectionTechnique,
    InvalidDetectionTechniqueError,
    get_detection_techniques,
    parse_detection_technique,
)


class FakeDetector:
    def __init__(self, timeseries, **kwargs):
        pass

    def detect_changes(self, **kwargs):
        return []


@pytest.fixture
def detectors(monkeypatch):
    detectors = {"fake": FakeDetector}
    monkeypatch.setattr(mozdetect, "get_timeseries_detectors", lambda detector_type: detectors)
    return detectors


@pytest.fixture
def mozdetect_detectors():
    # the real detectors from mozdetect
    return mozdetect.get_timeseries_detectors("ci")


def _signature(detection_techniques):
    return SimpleNamespace(id=1, detection_techniques=detection_techniques)


@pytest.mark.parametrize("config", ["fake", {"technique": "fake"}])
def test_parse_technique_name(detectors, config):
    assert parse_detection_technique(config, detectors) == DetectionTechnique(
        name="fake", technique="fake"
    )


def test_parse_technique_args(detectors):
    config = {"technique": "fake", "args": {"threshold": 2.0}}
    technique = parse_detection_technique(config, detectors)

    assert technique.name.startswith("fake-")
    # the default name is stable for the same configuration
    assert parse_detection_technique(dict(config), detectors).name == technique.name
    assert technique.args == {"threshold": 2.0}


def test_parse_technique_passes_any_args(detectors):
    technique = parse_detection_technique({"technique": "fake", "args": {"anything": 1}}, detectors)
    assert technique.args == {"anything": 1}


def test_parse_technique_with_name(detectors):
    technique = parse_detection_technique(
        {"name": "fake-custom", "technique": "fake", "args": {"window": 10}}, detectors
    )
    assert technique == DetectionTechnique(
        name="fake-custom", technique="fake", args={"window": 10}
    )


def test_parse_mozdetect_mwu(mozdetect_detectors):
    assert parse_detection_technique("mwu", mozdetect_detectors) == DetectionTechnique(
        name="mwu", technique="mwu"
    )


def test_parse_technique_with_preset(mozdetect_detectors):
    technique = parse_detection_technique(
        {"technique": "mwu", "preset": "sensitive"}, mozdetect_detectors
    )
    assert technique == DetectionTechnique(
        name="mwu-sensitive", technique="mwu", args=TECHNIQUE_PRESETS["mwu"]["sensitive"]
    )


def test_parse_technique_args_override_preset(mozdetect_detectors):
    config = {"technique": "mwu", "preset": "sensitive", "args": {"pvalue_threshold": 0.05}}
    technique = parse_detection_technique(config, mozdetect_detectors)

    assert technique.name.startswith("mwu-sensitive-")
    assert technique.name != "mwu-sensitive"
    # the hash tells apart different custom args on the same preset
    other_config = {**config, "args": {"pvalue_threshold": 0.01}}
    assert parse_detection_technique(other_config, mozdetect_detectors).name != technique.name
    assert technique.args == {
        **TECHNIQUE_PRESETS["mwu"]["sensitive"],
        "pvalue_threshold": 0.05,
    }


@pytest.mark.parametrize(
    "config",
    [
        {"technique": "ttest", "args": {"threshold": 0.01}},
        {"name": "ttest-custom", "technique": "ttest", "args": {"threshold": 0.01}},
    ],
)
def test_ttest_args_are_ignored(detectors, caplog, config):
    technique = parse_detection_technique(config, detectors)
    assert technique.technique == TTEST
    assert technique.args == {}
    assert technique.name == (config.get("name") or technique.name)
    assert technique.name.startswith("ttest-")
    assert "Ignoring arguments given to ttest: threshold" in caplog.text


@pytest.mark.parametrize(
    "config",
    [
        "unknown",
        {"technique": "unknown"},
        {"technique": "fake", "preset": "sensitive"},
        {"name": "fake,custom", "technique": "fake"},
    ],
)
def test_parse_invalid_technique(detectors, config):
    with pytest.raises(InvalidDetectionTechniqueError):
        parse_detection_technique(config, detectors)


@pytest.mark.parametrize("detection_techniques", [None, [], ["unknown"]])
def test_defaults_to_ttest(detectors, detection_techniques):
    assert get_detection_techniques(_signature(detection_techniques)) == [
        DetectionTechnique(name="ttest", technique=TTEST)
    ]


def test_skips_invalid_and_duplicate_techniques(detectors):
    signature = _signature(["fake", "unknown", {"technique": "fake"}, "ttest"])
    assert get_detection_techniques(signature) == [
        DetectionTechnique(name="fake", technique="fake"),
        DetectionTechnique(name="ttest", technique=TTEST),
    ]
