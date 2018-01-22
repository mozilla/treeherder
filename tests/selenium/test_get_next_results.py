import time

import pytest

from pages.treeherder import Treeherder


@pytest.fixture
def sample_push():
    sample_push = []
    for i in range(61):
        sample_push.append({
            'revision': 'revision{}'.format(i),
            'push_timestamp': int(time.time() + (i * 3600)),
            'author': 'Test author <test@example.com>',
            'revisions': [{
                'comment': 'Test commit',
                'author': 'Test author <test@example.com>',
                'revision': 'revision{}'.format(i)
            }]
        })
    return sample_push


@pytest.mark.parametrize('count', ((10), (20), (50)))
def test_get_next_results(base_url, selenium, count, push_stored):
    page = Treeherder(selenium, base_url).open()
    page.wait.until(lambda _: 10 == len(page.pushes))
    getattr(page, 'get_next_{}'.format(count))()
    assert len(page.pushes) == 10 + count
