import json

from django.http import HttpResponse

from django_browserid.util import LazyEncoder


class JSONResponse(HttpResponse):
    """
    HttpResponse that takes in a list or dict and outputs JSON for the response
    body.
    """
    def __init__(self, data, status=200):
        """
        :param data:
            List or dict to serialize to JSON in the response body.

        :param status:
            HTTP status code to use for this response. Defaults to 200.
        """
        data_json = json.dumps(data, cls=LazyEncoder)
        super(JSONResponse, self).__init__(
            data_json, content_type='application/json', status=status)
