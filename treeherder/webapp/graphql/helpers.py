
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
