from treeherder.log_parser.logparsecollection import LogParseCollection
from treeherder.log_parser.logviewparser import LogViewParser
from ..sampledata import SampleData
from tests import test_utils


import urllib2

"""
    will need tests with:
        multiple log references
        artifacts with logs
"""


def get_test_data(name_prefix):
    """Returns a tuple with (url, exp)"""
    return (
        "{0}.txt.gz".format(name_prefix),
        test_utils.load_exp("{0}.logview.json".format(name_prefix))
    )


def test_single_log_header(jm, initial_data, monkeypatch):
    """Process a job with a single log reference."""

    def mock_log_handle(mockself, url):
        """Opens the log as a file, rather than a url"""
        return open(SampleData().get_log_path(url))

    monkeypatch.setattr(LogParseCollection, 'get_log_handle', mock_log_handle)

    name = "unittest",
    url, exp = get_test_data(
        "mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141"
        )

    jap = LogViewParser("mochitest")
    lpc = LogParseCollection(url, name, parsers=jap)
    lpc.parse()
    exp = {
        "slave": "tst-linux32-ec2-137",
        "buildid": "20130513091541",
        "builder": "mozilla-central_ubuntu32_vm_test-crashtest-ipc",
        "results": "success (0)",
        "starttime": "1368466076.01",
        "builduid": "acddb5f7043c4d5b9f66619f9433cab0",
        "revision": "c80dc6ffe865"
    }
    act = lpc.artifacts[jap.name]["header"]
    assert act == exp, test_utils.diff_dict(exp, act)


def test_crashtest_passing(jm, initial_data, monkeypatch):
    """Process a job with a single log reference."""

    def mock_log_handle(mockself, url):
        """Opens the log as a file, rather than a url"""
        return open(SampleData().get_log_path(url))

    monkeypatch.setattr(LogParseCollection, 'get_log_handle', mock_log_handle)

    name = "unittest",
    url, exp = get_test_data(
        "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    )

    parser = LogViewParser("crashtest")
    lpc = LogParseCollection(url, name, parsers=parser)
    lpc.parse()
    act = lpc.artifacts[parser.name]

    assert act == exp, test_utils.diff_dict(exp, act)


def test_mochitest_pass(jm, initial_data, monkeypatch):
    """Process a job with a single log reference."""

    def mock_log_handle(mockself, url):
        """Opens the log as a file, rather than a url"""
        return open(SampleData().get_log_path(url))

    monkeypatch.setattr(LogParseCollection, 'get_log_handle', mock_log_handle)

    name = "unittest",
    url, exp = get_test_data(
        "mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141"
    )
    parser = LogViewParser("mochitest")
    lpc = LogParseCollection(url, name, parsers=parser)
    lpc.parse()
    act = lpc.artifacts[parser.name]

    assert act == exp, test_utils.diff_dict(exp, act)


def xtest_mochitest_fail(jm, initial_data, monkeypatch):
    """Process a job with a single log reference."""

    def mock_log_handle(mockself, url):
        """Opens the log as a file, rather than a url"""
        return open(SampleData().get_log_path(url))

    monkeypatch.setattr(LogParseCollection, 'get_log_handle', mock_log_handle)

    name = "unittest",
    url, exp = get_test_data(
        "mozilla-central_win7-ix-debug_test-mochitest-1-bm72-tests1-windows-build12_fails"
    )
    parser = LogViewParser("mochitest")
    lpc = LogParseCollection(url, name, parsers=parser)
    lpc.parse()
    act = lpc.artifacts[parser.name]

    assert act == exp, test_utils.diff_dict(exp, act)


def xtest_download_logs(sample_data):
    """
    http://ftp.mozilla.org/pub/mozilla.org/firefox/tinderbox-builds/
    mozilla-central-win32/1367008984/
    mozilla-central_win8_test-dirtypaint-bm74-tests1-windows-build6.txt.gz
    """
    lognames = []
    for job in sample_data.job_data:
        logrefs = job["job"]["log_references"]
        for log in logrefs:
            lognames.append(log["name"])
            url = log["url"]
            try:
                handle = urllib2.urlopen(url)
                with open(url.rsplit("/", 1)[1], "wb") as out:
                    while True:
                        data = handle.read(1024)
                        if len(data) == 0:
                            break
                        out.write(data)
            except urllib2.HTTPError:
                pass

    assert set(lognames) == ""
