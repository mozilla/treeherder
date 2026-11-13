import hashlib
import json
import logging
from dataclasses import dataclass, field

import mozdetect

logger = logging.getLogger(__name__)

TTEST = "ttest"
DEFAULT_DETECTION_TECHNIQUES = [TTEST]

# Separator for methods that detected the same alert
DETECTION_METHOD_SEPARATOR = ","

# Presets of args for specific behaviours
TECHNIQUE_PRESETS = {
    "mwu": {
        "sensitive": {"pvalue_threshold": 0.01, "cliffs_threshold": 0.33},
        "strict": {"pvalue_threshold": 0.0001, "cliffs_threshold": 0.474},
    },
}


class InvalidDetectionTechniqueError(ValueError):
    pass


@dataclass(frozen=True)
class DetectionTechnique:
    # The actual name of the technique so we can have multiple detection techniques
    # using the same technique but with different args.
    name: str

    # The base technique that ends up being used.
    technique: str

    # Contains custom arguments for the technique.
    args: dict = field(default_factory=dict)


def _get_default_name(config):
    """Returns the name to use for the technique.
    Uses this format: <technique>[-<preset>][-<hash of the custom args>]

    :param dict config: Config for the technique.
    """
    name_parts = [config["technique"]]

    if config.get("preset"):
        name_parts.append(config["preset"])

    if config.get("args"):
        serialized_args = json.dumps(config["args"], sort_keys=True).encode("utf-8")
        name_parts.append(hashlib.sha1(serialized_args).hexdigest()[:8])

    return "-".join(name_parts)


def parse_detection_technique(config, detectors):
    """Builds the DetectionTechnique described by an entry of a signature's
    `detection_techniques`, which is either the technique's name or an object
    configuring it (see the performance artifact schema).

    :param dict detectors: mozdetect's CI detectors, by technique name.
    """

    # Techniques can be specified either by name for default settings or with
    # some options as a dict. Convert to a dict here to simplify the rest.
    if isinstance(config, str):
        config = {"technique": config}

    technique = config.get("technique")
    if technique != TTEST and technique not in detectors:
        raise InvalidDetectionTechniqueError(f"Unknown detection technique: {technique}")

    # Gather any preset options
    args = {}
    preset = config.get("preset")
    if preset is not None:
        presets = TECHNIQUE_PRESETS.get(technique, {})
        if preset not in presets:
            raise InvalidDetectionTechniqueError(f"Unknown preset for {technique}: {preset}")
        args.update(presets[preset])

    # Gather any custom args (they overwrite the preset ones)
    custom_args = config.get("args") or {}
    if technique == TTEST and custom_args:
        # Ttest doesn't take any args atm so just output a warning
        logger.warning(f"Ignoring arguments given to {TTEST}: {', '.join(sorted(custom_args))}")
        custom_args = {}
    args.update(custom_args)

    # Build the technique's unique name if needed
    name = config.get("name") or _get_default_name(config)
    if DETECTION_METHOD_SEPARATOR in name:
        raise InvalidDetectionTechniqueError(
            f"Detection technique names can't contain {DETECTION_METHOD_SEPARATOR!r}: {name}"
        )

    return DetectionTechnique(
        name=name,
        technique=technique,
        args=args,
    )


def get_detection_techniques(signature):
    """Returns the DetectionTechniques to run on a signature's data.

    Invalid entries are skipped. A signature that doesn't ask for any
    technique, or whose entries are all invalid, gets the default T-Test so
    it doesn't go unalerted.
    """
    detection_techniques = signature.detection_techniques or []
    detectors = mozdetect.get_timeseries_detectors("ci")

    techniques = {}
    for config in detection_techniques:
        try:
            technique = parse_detection_technique(config, detectors)
            techniques.setdefault(technique.name, technique)
        except InvalidDetectionTechniqueError as e:
            logger.warning(f"Skipping detection technique of signature {signature.id}: {e}")
            continue

    if not techniques:
        # Generic so that we can add more defaults in the future
        return [
            parse_detection_technique(config, detectors) for config in DEFAULT_DETECTION_TECHNIQUES
        ]
    return list(techniques.values())
