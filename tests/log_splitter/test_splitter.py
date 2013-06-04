import pytest
import gzip
import os
import re

from treeherder.log_splitter import splitter, buildbotsplitter

SAMPLE = os.path.join(os.path.dirname(__file__), '..', 'sample_data',
    'birch_ubuntu32_vm_test-crashtest-bm52-tests1-linux-build7.txt.gz')

def test_buildbot_splitter():
    file = gzip.open(SAMPLE)
    log = buildbotsplitter.split(file)
    file.close()
    # should read properties from the preamble
    assert log.properties['builder'] == 'birch_ubuntu32_vm_test-crashtest'
    assert log.properties['slave'] == 'tst-linux32-ec2-035'
    # should detect the steps correctly
    assert len(log.steps) == 13
    names = map(lambda step: step.name, log.steps[1:])
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
    # should collect all the lines of individual steps
    assert len(log.steps[1].lines) == 4
    assert len(log.steps[2].lines) == 42
    # should save start and end times as datetime objects
    assert log.steps[1].start_time.strftime(buildbotsplitter.date_format) == '2013-04-26 15:07:39.638474'
    assert log.steps[1].end_time.strftime(buildbotsplitter.date_format) == '2013-04-26 15:07:39.639274'

def test_generic_splitter():
    start = (
        re.compile('start (\d) (\d+)'),
        ['num', lambda step, match: setattr(step, 'num2', match)]
    )
    end = (
        re.compile('end (\w+) (\d)'),
        ['name'],
        [None, 1]
    )
    test_splitter = splitter.Splitter(start, end)
    input = map(lambda s: s.strip(), """
    preamble
    start 1 123
    foo
    end foo 1
    start 2 456
    bar
    end bar 2
    """.split('\n'))[1:]
    output = test_splitter.split(input)
    # should collect the preamble as first step
    assert output[0].lines == ['preamble']
    # should support string mapping
    assert output[1].num == '1'
    assert output[2].num == '2'
    assert output[1].name == 'foo'
    assert output[2].name == 'bar'
    # should support callback mapping
    assert output[1].num2 == '123'
    assert output[2].num2 == '456'

    # should throw on non-matching groups
    try:
        test_splitter.split(['start 1 123', 'end foo 2'])
        raise 'failed rejecting non-matching groups'
    except:
        pass

