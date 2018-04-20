from six import string_types

from .connection import es_conn


def dict_to_op(d, op_type='index'):
    """
    Create a bulk-indexing operation from the given dictionary.
    """
    if d is None:
        return d

    if 'id' not in d:
        raise Exception('"id" key not found')

    id = d.pop('id')

    op = getattr(es_conn, '{}_op'.format(op_type), None)
    if op is None:
        # Build up a useful error message
        op_types = filter(lambda m: m.endswith('_op'), dir(es_conn))
        op_types = (t[:-3] for t in op_types)
        op_types = ', '.format(op_types)
        msg = 'Unkown operation type "{}", pick one of: {}'
        raise Exception(msg.format(op_type, op_types))

    return op(d, id=id)


def to_dict(obj):
    """
    Create a filtered dict from the given object.

    Note: This function is currently specific to the FailureLine model.
    """
    if not isinstance(obj.test, string_types):
        # TODO: can we handle this in the DB?
        # Reftests used to use tuple indicies, which we can't support.
        # This is fixed upstream, but we also need to handle it here to allow
        # for older branches.
        return

    keys = [
        'id',
        'job_guid',
        'test',
        'subtest',
        'status',
        'expected',
        'message',
        'best_classification',
        'best_is_verified',
    ]

    all_fields = obj.to_dict()
    return {k: v for k, v in all_fields.iteritems() if k in keys}
