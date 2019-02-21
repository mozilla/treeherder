import logging

import newrelic.agent
from rest_framework.parsers import JSONParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class CSPReportParser(JSONParser):
    # Reports are submitted with a Content-Type that is not `application/json`, so we
    # have to tell django-rest-framework that it should still parse the body as JSON:
    # https://w3c.github.io/webappsec-csp/2/#violation-reports
    # https://www.django-rest-framework.org/api-guide/parsers/#how-the-parser-is-determined
    media_type = 'application/csp-report'


class CSPReportView(APIView):
    """
    Accepts the Content-Security-Policy violation reports generated via the `report-uri` feature:
    https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri
    """

    # We want to receive all CSP violation reports, including from unauthenticated users.
    permission_classes = (AllowAny,)
    parser_classes = (CSPReportParser,)

    def post(self, request):
        try:
            report = request.data['csp-report']
        except (KeyError, TypeError):
            return Response('Invalid CSP violation report', status=HTTP_400_BAD_REQUEST)

        logger.warning('CSP violation: %s', report)
        newrelic.agent.record_custom_event('CSP violation', report)
        return Response()
