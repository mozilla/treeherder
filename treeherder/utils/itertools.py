def icompact(iterable):
    """
    Lazily remove empty values from an iterable.

        >>> list(icompact(range(3)))
        [1, 2]
        >>> list(icompact(['thing', 1, 0, None, 'bar', {}]))
        ['thing', 1, 'bar']

    """
    return (x for x in iterable if x)


def compact(iterable):
    """
    Returns a new list with all empty values removed from the iterable.

        >>> compact(range(3))
        [1, 2]
        >>> compact(['thing', 1, 0, None, 'bar', {}])
        ['thing', 1, 'bar']

    """
    return list(icompact(iterable))
