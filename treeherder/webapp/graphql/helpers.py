from graphene_django.filter import DjangoFilterConnectionField


def collect_fields(node):
    """
    Get all the unique field names that are eligible for optimization

    Requested a function like this be added to the ``info`` object
    upstream in graphene_django:
    https://github.com/graphql-python/graphene-django/issues/230
    """
    fields = set()
    for leaf in node:
        if leaf.get('kind', None) == "Field":
            fields.add(leaf["name"]["value"])

        if leaf.get("selection_set", None):
            fields = fields.union(collect_fields(leaf["selection_set"]["selections"]))

    return fields


def optimize(qs, info_dict, field_map):
    """Add either select_related or prefetch_related to fields of the qs"""
    fields = collect_fields(info_dict)
    for field in fields:
        if field in field_map:
            field_name, opt = field_map[field]
            qs = (qs.prefetch_related(field_name)
                  if opt == "prefetch" else qs.select_related(field_name))

    return qs


class OptimizedFilterConnectionField(DjangoFilterConnectionField):
    """
    Override a problem function in DjangoFilterConnectionField

    I have submitted PR: https://github.com/graphql-python/graphene-django/pull/224
    to address this upstream.
    """

    @staticmethod
    def merge_querysets(default_queryset, queryset):
        # There could be the case where the default queryset (returned from
        # the filterclass)
        # and the resolver queryset have some limits on it.
        # We only would be able to apply one of those, but not both
        # at the same time.

        # See related PR: https://github.com/graphql-python/graphene-django
        # /pull/126

        assert not (
            default_queryset.query.low_mark and queryset.query.low_mark), (
                'Received two sliced querysets (low mark) in the connection, '
                'please slice only in one.'
            )
        assert not (
            default_queryset.query.high_mark and queryset.query.high_mark), (
                'Received two sliced querysets (high mark) in the connection, '
                'please slice only in one.'
            )
        low = default_queryset.query.low_mark or queryset.query.low_mark
        high = default_queryset.query.high_mark or queryset.query.high_mark
        default_queryset.query.clear_limits()

        # my changed line for PR 224 upstream:
        queryset = queryset & default_queryset
        queryset.query.set_limits(low, high)

        return queryset
