import json

from treeherder.log_parser.logparsecollection import LogParseCollection
from treeherder.log_parser.logviewparser import BuildbotLogViewParser

from tests import test_utils
from ..sampledata import SampleData

import urllib2


def do_test(job_type, log):
    """
    Test a single log.

    ``job_type`` - Something like "mochitest", "crashtest" or "reftest"
    ``log`` - the url prefix of the log to test.  Also searches for the
              result file with the same prefix.
    """

    url = "file://{0}".format(
        SampleData().get_log_path("{0}.txt.gz".format(log)))
    exp = test_utils.load_exp("{0}.logview.json".format(log))

    jap = BuildbotLogViewParser(job_type, url)
    lpc = LogParseCollection(url, parsers=jap)
    lpc.parse()
    act = lpc.artifacts[jap.name]
    # assert act == exp, test_utils.diff_dict(exp, act)
    assert act == exp, json.dumps(act, indent=4)


def test_crashtest_passing(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "crashtest",
        "mozilla-central_fedora-b2g_test-crashtest-1-bm54-tests1-linux-build50"
    )


def test_mochitest_pass(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "mochitest",
        "mozilla-central_mountainlion_test-mochitest-2-bm77-tests1-macosx-build141"
    )


def test_mochitest_fail(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "mochitest",
        "mozilla-esr17_xp_test_pgo-mochitest-browser-chrome-bm74-tests1-windows-build12"
    )


def test_mochitest_process_crash(jm, initial_data):
    """Test a mochitest log that has PROCESS-CRASH """

    do_test(
        "mochitest",
        "mozilla-inbound_ubuntu64_vm-debug_test-mochitest-other-bm53-tests1-linux-build122"
    )


def test_jetpack_fail(jm, initial_data):
    """Process a job with a single log reference."""

    do_test(
        "jetpack",
        "ux_ubuntu32_vm_test-jetpack-bm67-tests1-linux-build16"
    )


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
