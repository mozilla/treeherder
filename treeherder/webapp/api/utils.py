import datetime
import functools
import time
from collections import defaultdict

from treeherder.model.derived import JobsModel


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
        "in": "IN",
        "ne": "<>",
        "nin": "NOT IN"
    }

    splitter = "__"

    def __init__(self, query_params):
        self.raw_params = query_params
        self.conditions = defaultdict(set)
        for k, v in self.raw_params.iteritems():
            if self.splitter in k:
                field, operator = k.split(self.splitter, 1)
                if operator not in self.operators:
                    raise ValueError("{0} is not a supported operator".format(operator))
                if operator in ("in", "nin"):
                    v = tuple(v.split(","))
            else:
                field = k
                operator = "="

            self.conditions[field].add((self.operators[operator], v))

    def get(self, key, default=None):
        if key in self.conditions:
            value = self.conditions[key]
            if len(value) == 1:
                value = value.pop()
                if value[0] == "=":
                    value = value[1]
            return value
        else:
            if default:
                return default
            raise KeyError(key)

    def delete(self, key):
        del self.conditions[key]

    def pop(self, key, default=None):
        try:
            value = self.get(key)
            self.delete(key)
            return value
        except KeyError as e:
            if default is not None:
                return default
            raise e


def with_jobs(model_func):
    """
    Create a jobsmodel and pass it to the ``func``.

    ``func`` must take a jobsmodel object and return a response object

    """
    @functools.wraps(model_func)
    def use_jobs_model(*args, **kwargs):

        project = kwargs["project"]
        with JobsModel(project) as jm:
            return model_func(*args, jm=jm, **kwargs)

    return use_jobs_model


def to_timestamp(datestr):
    """get a timestamp from a datestr like 2014-03-31"""
    return time.mktime(datetime.datetime.strptime(
        datestr,
        "%Y-%m-%d"
    ).timetuple())


def as_dict(queryset, key):
    return {getattr(item, key): item for item in queryset}
