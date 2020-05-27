import pytest
from betamax import Betamax
from betamax_serializers import pretty_json
from requests import Session

from treeherder.perf.sheriffing_criteria import NonBlockableSession


CASSETTE_LIBRARY_DIR = 'tests/sample_data/betamax_cassettes/perf_sheriffing_criteria'


@pytest.fixture
def nonblock_session() -> Session:
    return NonBlockableSession()


@pytest.fixture
def unrecommended_session() -> Session:
    return Session()


@pytest.fixture
def betamax_recorder(nonblock_session):
    Betamax.register_serializer(pretty_json.PrettyJSONSerializer)
    return Betamax(nonblock_session, cassette_library_dir=CASSETTE_LIBRARY_DIR)
