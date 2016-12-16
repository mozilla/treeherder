import pytest

from treeherder.seta.analyze_failures import get_failures_fixed_by_commit


@pytest.mark.django_db()
def test_analyze_failures(eleven_jobs_with_notes):
    failures_fixed_by_commit = get_failures_fixed_by_commit()
    assert failures_fixed_by_commit == {
        u'you look like a man-o-lantern': [(u'build', u'opt', u'android-4-0-armv7-api15'),
                                           (u'build', u'opt', u'linux64'),
                                           (u'build', u'opt', u'linux32'),
                                           (u'build', u'debug', u'linux32'),
                                           (u'build', u'debug', u'linux64'),
                                           (u'build', u'debug', u'osx-10-7'),
                                           (u'build', u'opt', u'osx-10-7'),
                                           (u'build', u'debug', u'osx-10-7'),
                                           (u'build', u'opt', u'windowsxp'),
                                           (u'mochitest-media-1', u'opt', u'android-4-3-armv7-api15')]}
