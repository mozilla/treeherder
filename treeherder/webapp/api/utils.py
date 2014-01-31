from collections import defaultdict


class UrlQueryFilter(object):
    """
    This class converts a set of querystring parameters
    to a set of where conditions. It should be generic enough to
    be used from any list method of a viewset. The style of filters
    is strongly inspired by the django orm filters.

    Examples of conversions:

    {
        "name": "john",
        "age__gte":30,
        "weight__lt":80
        "gender__in": "male,female"
    }

    becomes

    {
        'name': set([('=', 'john')]),
        'age': set([('>=', 30)]),
        'weight': set([('<', 80)])
        'gender': set([('IN', "male,female")])
    }


    """
    operators = {
        "gt": ">",
        "gte": ">=",
        "lt": "<",
        "lte": "<=",
        "=": "=",
        "in": "IN"
    }

    splitter = "__"

    def __init__(self, query_params):
        self.params = query_params

    def parse(self):
        """
        Parse the query_params using self.operators for the conversion
        """
        filters = defaultdict(set)
        for k, v in self.params.iteritems():
            if self.splitter in k:
                field, operator = k.split(self.splitter, 1)
                if operator not in self.operators:
                    raise ValueError("{0} is not a supported operator".format(operator))
                if operator == "in":
                    v = tuple(v.split(","))
            else:
                field = k
                operator = "="

            filters[field].add((self.operators[operator], v))
        return filters
