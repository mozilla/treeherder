def chunked_qs(qs, chunk_size=10000, fields=None):
    """
    Generator to iterate over the given QuerySet, chunk_size rows at a time.

    Usage:

        >>> qs = FailureLine.objects.filter(action='test_result')
        >>> for qs in chunked_qs(qs, chunk_size=10000, fields=['id', 'message']):
        ...     for line in qs:
        ...         print(line.message)

    Note: While Django 2.0 provides chunking [1] via QuerySet.iterator() we
    can't make use of this while using MySQL which doesn't support streaming
    results.

    [1]: https://docs.djangoproject.com/en/2.0/ref/models/querysets/#iterator
    """
    min_id = 0

    while True:
        chunk = qs.filter(id__gt=min_id).order_by('id')

        if fields is not None:
            chunk = chunk.only(*fields)

        # Cast to a list to execute the QuerySet here and allow us to get the
        # last ID when updating min_id.  We can't use .last() later as it
        # ignores the slicing we do.
        rows = list(chunk[:chunk_size])

        total = len(rows)

        if total < 1:
            break

        yield rows

        # update the minimum ID for next iteration
        min_id = rows[-1].id


def chunked_qs_reverse(qs, chunk_size=10000):
    """
    Generator to iterate over the given QuerySet in reverse chunk_size rows at a time.

    Usage:

        >>> qs = FailureLine.objects.filter(action='test_result')
        >>> for qs in chunked_qs_reverse(qs, chunk_size=100):
        ...     for line in qs:
        ...         print(line.message)

    Note: This method is just different enough that it seemed easier to keep
    this function separate to chunked_qs.
    """
    if not qs:
        return

    qs = qs.order_by('-id')

    # Can't use .only() here in case the query used select_related
    max_id = qs.first().id
    while True:
        chunk = qs.filter(id__lte=max_id)  # upper bound of this chunk

        rows = chunk[:chunk_size]

        if len(rows) < 1:
            break

        yield rows

        # update the maximum ID for next iteration
        max_id = max_id - chunk_size
