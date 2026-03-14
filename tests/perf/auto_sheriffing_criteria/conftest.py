import pytest
import requests.adapters
import vcr
from requests import Session

from treeherder.perf.sheriffing_criteria import NonBlockableSession

CASSETTE_LIBRARY_DIR = "tests/sample_data/vcr_cassettes/perf_sheriffing_criteria"
CASSETTES_RECORDING_DATE = "June 2nd, 2020"  # when VCR has been conducted

# Capture the real HTTPAdapter.send before the session-scoped
# block_unmocked_requests fixture replaces it with a blocker.
# VCR.py intercepts at the httplib level, so it needs the real
# adapter.send to be in place for the request to reach httplib.
_original_http_send = requests.adapters.HTTPAdapter.send


@pytest.fixture
def nonblock_session() -> Session:
    return NonBlockableSession()


@pytest.fixture
def unrecommended_session() -> Session:
    return Session()


@pytest.fixture
def vcr_recorder():
    """VCR.py recorder for HTTP cassette playback.

    Temporarily restores the real HTTPAdapter.send so VCR.py can intercept
    at the httplib level. VCR.py in record_mode="none" will raise
    CannotSendRequest for any un-cassetteed requests, acting as its own guard.
    """
    patched_send = requests.adapters.HTTPAdapter.send
    requests.adapters.HTTPAdapter.send = _original_http_send

    yield vcr.VCR(
        cassette_library_dir=CASSETTE_LIBRARY_DIR,
        record_mode="none",
    )

    requests.adapters.HTTPAdapter.send = patched_send
