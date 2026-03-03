GLEAN_DICTIONARY = "https://dictionary.telemetry.mozilla.org/apps/{page}/metrics/{probe}"
GLEAN_PROBE_INFO = (
    "https://dictionary.telemetry.mozilla.org/data/firefox_desktop/metrics/data_{probe_name}.json"
)
TREEHERDER_PUSH = "https://treeherder.mozilla.org/jobs?repo={repo}&revision={revision}"
TREEHERDER_DATES = (
    "https://treeherder.mozilla.org/jobs?repo={repo}&fromchange={from_change}&tochange={to_change}"
)
PUSH_LOG = (
    "https://hg-edge.mozilla.org/mozilla-central/pushloghtml?"
    "startdate={start_date}&enddate={end_date}"
)
TELEMETRY_ALERT_DASHBOARD = "https://gmierz.github.io/telemetry-alert-dashboard/?view=grouped&alertSummaryId={alert_summary_id}"
BZ_TELEMETRY_ALERTS_CHANGED = (
    "https://bugzilla.mozilla.org/rest/bug?"
    "include_fields=id&include_fields=resolution"
    "&f1=keywords&o1=allwords&v1=telemetry-alert"
    "&f2=resolution&o2=changedbefore&v2={today}"
    "&f3=resolution&o3=changedafter&v2={prev_day}"
)
REVISION_INFO = "https://hg.mozilla.org/mozilla-central/json-log/%s"

DEFAULT_CHANGE_DETECTION = "cdf_squared"
DESKTOP_PLATFORMS = (
    "Windows",
    "Linux",
    "Darwin",
)
CHANNEL_TO_REPO_MAPPING = {
    "Nightly": "mozilla-central",
    "Release": "mozilla-release",
    "Beta": "mozilla-beta",
}

MODIFIABLE_ALERT_FIELDS = ("status",)
DEFAULT_ALERT_EMAIL = "gmierzwinski@mozilla.com"
EMAIL_LIMIT = 50


def get_glean_dictionary_link(telemetry_signature):
    if telemetry_signature.platform in DESKTOP_PLATFORMS:
        dictionary_page = "firefox_desktop"
    else:
        dictionary_page = "fenix"
    return GLEAN_DICTIONARY.format(page=dictionary_page, probe=telemetry_signature.probe)


def get_treeherder_detection_link(detection_range, telemetry_signature):
    repo = CHANNEL_TO_REPO_MAPPING.get(telemetry_signature.channel, "mozilla-central")

    return TREEHERDER_PUSH.format(repo=repo, revision=detection_range["detection"].revision)


def get_treeherder_detection_range_link(detection_range, telemetry_signature):
    repo = CHANNEL_TO_REPO_MAPPING.get(telemetry_signature.channel, "mozilla-central")

    return TREEHERDER_DATES.format(
        repo=repo,
        from_change=detection_range["from"].revision,
        to_change=detection_range["to"].revision,
    )
