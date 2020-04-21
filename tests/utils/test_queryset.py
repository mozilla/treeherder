from tests.autoclassify.utils import create_failure_lines, test_line
from treeherder.model.models import FailureLine
from treeherder.utils.queryset import chunked_qs, chunked_qs_reverse


def test_chunked_qs(test_job):
    # create 25 failure lines
    create_failure_lines(test_job, [(test_line, {}) for i in range(25)])

    qs = FailureLine.objects.all()
    chunks = list(chunked_qs(qs, chunk_size=5))

    one = chunks[0]
    two = chunks[1]
    five = chunks[4]

    assert len(one) == 5
    assert one[0].id == 1
    assert one[4].id == 5

    assert len(two) == 5
    assert two[0].id == 6
    assert two[4].id == 10

    assert len(five) == 5
    assert five[0].id == 21
    assert five[4].id == 25


def test_chunked_qs_with_empty_qs():
    chunks = list(chunked_qs(FailureLine.objects.none()))

    assert len(chunks) == 0


def test_chunked_qs_reverse(test_job):
    """
    Test `chunked_qs_reverse` function

    Specifically checks the length of chunks and their items don't overlap.
    """
    # create 25 failure lines
    create_failure_lines(test_job, [(test_line, {}) for i in range(25)])

    qs = FailureLine.objects.all()
    chunks = list(chunked_qs_reverse(qs, chunk_size=5))

    one = chunks[0]
    two = chunks[1]
    five = chunks[4]

    assert len(one) == 5
    assert one[0].id == 25
    assert one[4].id == 21

    assert len(two) == 5
    assert two[0].id == 20
    assert two[4].id == 16

    assert len(five) == 5
    assert five[0].id == 5
    assert five[4].id == 1


def test_chunked_qs_reverse_with_empty_qs():
    chunks = list(chunked_qs_reverse(FailureLine.objects.none()))

    assert len(chunks) == 0
