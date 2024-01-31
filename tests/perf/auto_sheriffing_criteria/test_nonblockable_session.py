import pytest


def test_nonblockable_sessions_has_the_recommended_headers(nonblock_session):
    session_headers = nonblock_session.headers

    try:
        assert session_headers["Referer"]
        assert session_headers["User-Agent"]
    except KeyError:
        pytest.fail()
