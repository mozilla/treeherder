import pytest

from treeherder.seta.analyze_failures import get_failures_fixed_by_commit


@pytest.mark.django_db()
def test_analyze_failures(eleven_jobs_with_notes):
    failures_fixed_by_commit = get_failures_fixed_by_commit()
    assert failures_fixed_by_commit == {
        u'you look like a man-o-lantern': [
            (u'build', u'debug', u'windows8-64'),
            (u'build', u'opt', u'windows8-64'),
            (u'build', u'debug', u'linux64'),
            (u'build', u'debug', u'windowsxp'),
            (u'build', u'debug', u'osx-10-7'),
            (u'build', u'opt', u'osx-10-7'),
            (u'mochitest-3', u'opt', u'android-4-3-armv7-api15'),
            (u'mochitest-media-2', u'opt', u'android-4-3-armv7-api15'),
            (u'robocop-3', u'opt', u'android-4-3-armv7-api15'),
            (u'mochitest-7', u'opt', u'android-4-3-armv7-api15')]}
