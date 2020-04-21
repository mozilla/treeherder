def dict_to_op(d, index_name, doc_type, op_type='index'):
    """
    Create a bulk-indexing operation from the given dictionary.
    """
    if d is None:
        return d

    op_types = ('create', 'delete', 'index', 'update')
    if op_type not in op_types:
        msg = 'Unknown operation type "{}", must be one of: {}'
        raise Exception(msg.format(op_type, ', '.join(op_types)))

    if 'id' not in d:
        raise Exception('"id" key not found')

    operation = {
        '_op_type': op_type,
        '_index': index_name,
        '_type': doc_type,
        '_id': d.pop('id'),
    }
    operation.update(d)

    return operation


def to_dict(obj):
    """
    Create a filtered dict from the given object.

    Note: This function is currently specific to the FailureLine model.
    """
    if not isinstance(obj.test, str):
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
    return {k: v for k, v in all_fields.items() if k in keys}
