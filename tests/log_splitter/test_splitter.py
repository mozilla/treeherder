import pytest
import gzip
import os

import treeherder.log_splitter.splitter as splitter

SAMPLE = os.path.join(os.path.dirname(__file__), '..', 'sample_data',
    'birch_ubuntu32_vm_test-crashtest-bm52-tests1-linux-build7.txt.gz')

def test_splitter():
    file = gzip.open(SAMPLE)
    log = splitter.split(file)
    file.close()
    assert log.properties['builder'] == 'birch_ubuntu32_vm_test-crashtest'
    assert log.properties['slave'] == 'tst-linux32-ec2-035'
    assert len(log.steps) == 12
    names = map(lambda step: step.name, log.steps)
    print names
    assert names == [
        'set props: master',
        'set props: basedir',
        'downloading to buildprops.json',
        "'rm -rf ...'",
        "'rm -rf ...'",
        "'hg clone ...'",
        "'hg update ...'",
        'set props: script_repo_revision',
        'tinderboxprint_script_revlink',
        "'/tools/buildbot/bin/python scripts/scripts/desktop_unittest.py ...'",
        'set props: build_url',
        'reboot slave lost'
    ]
    assert len(log.steps[0].log) == 1
    assert len(log.steps[1].log) == 39
    assert log.steps[0].start_time.strftime(splitter.date_format) == '2013-04-26 15:07:39.638474'
    assert log.steps[0].end_time.strftime(splitter.date_format) == '2013-04-26 15:07:39.639274'
    pass
