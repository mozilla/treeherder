from collections import defaultdict

import simplejson as json
import oauth2 as oauth
import time
import datetime

from django.conf import settings
from rest_framework.response import Response

from treeherder.model.derived import (JobsModel, DatasetNotFoundError,
                                      ObjectNotFoundException)
from treeherder.etl.oauth_utils import OAuthCredentials


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
        except KeyError, e:
            if default is not None:
                return default
            raise e


def oauth_required(func):

    def wrap_oauth(cls, *args, **kwargs):

        # First argument must be request object
        request = args[0]

        # Get the project keyword argumet
        project = kwargs.get('project', None)

        # Get the project credentials
        project_credentials = OAuthCredentials.get_credentials(project)

        if not project_credentials:
            msg = {
                'response': "invalid_request",
                'message': "project, {0}, has no OAuth credentials".format(project)
            }
            return Response(msg, 500)

        parameters = OAuthCredentials.get_parameters(request.QUERY_PARAMS)

        oauth_body_hash = parameters.get('oauth_body_hash', None)
        oauth_signature = parameters.get('oauth_signature', None)
        oauth_consumer_key = parameters.get('oauth_consumer_key', None)
        oauth_token = parameters.get('oauth_token', None)

        if not oauth_body_hash or not oauth_signature or not oauth_consumer_key:

            msg = {
                'response':"invalid_request",
                'message':"Required oauth parameters not provided in the uri"
                }

            return Response(msg, 500)

        if oauth_consumer_key != project_credentials['consumer_key']:
            msg = {
                'response':"access_denied",
                'message':"oauth_consumer_key does not match project, {0}, credentials".format(project)
                }

            return Response(msg, 403)

        uri = '{0}://{1}{2}'.format(
            settings.TREEHERDER_REQUEST_PROTOCOL, request.get_host(),
            request.path
            )

        #Construct the OAuth request based on the django request object
        req_obj = oauth.Request(
            method=request.method,
            url=uri,
            parameters=parameters,
            body=json.dumps(request.DATA),
            )

        server = oauth.Server()
        token = oauth.Token(key='', secret='')

        #Get the consumer object
        cons_obj = oauth.Consumer(
            oauth_consumer_key,
            project_credentials['consumer_secret']
            )

        #Set the signature method
        server.add_signature_method(oauth.SignatureMethod_HMAC_SHA1())

        try:
            #verify oauth django request and consumer object match
            server.verify_request(req_obj, cons_obj, token)
        except oauth.Error:
            msg = {
                'response':"invalid_client",
                'message':"Client authentication failed for project, {0}".format(project)
                }

            return Response(msg, 403)

        return func(request, *args, **kwargs)

    return wrap_oauth

def with_jobs(model_func):
    """
    Create a jobsmodel and pass it to the ``func``.

    ``func`` must take a jobsmodel object and return a response object

    Catches exceptions
    """
    def use_jobs_model(*args, **kwargs):
        project = kwargs["project"]
        try:
            jm = JobsModel(project)
            return model_func(*args, jm=jm, **kwargs)

        except DatasetNotFoundError as e:
            return Response(
                {"message": "No project with name {0}".format(project)},
                status=404,
            )
        except ObjectNotFoundException as e:
            return Response({"message": unicode(e)}, status=404)
        except Exception as e:  # pragma nocover
            msg = {"message": unicode(e)}
            if settings.DEBUG:
                import traceback
                msg["traceback"] = traceback.format_exc()

            return Response(msg, status=500)
        finally:
            jm.disconnect()

    return use_jobs_model


def get_option(obj, option_collections):
    """Get the option, if there is one.  Otherwise, return None."""
    opt = obj.get("option_collection_hash", None)
    if (opt):
        return option_collections[opt]['opt']
    else:
        return None


def to_timestamp(datestr):
    """get a timestamp from a datestr like 2014-03-31"""
    return time.mktime(datetime.datetime.strptime(
        datestr,
        "%Y-%m-%d"
        ).timetuple())

def get_revision_timestamp(jm, rev):
    """Get the push timestamp of the resultset for a revision"""
    return jm.get_revision_resultset_lookup([rev])[rev][
        "push_timestamp"
        ]
