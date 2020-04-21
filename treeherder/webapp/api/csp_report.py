import json
import logging

import newrelic.agent
from django.http import HttpResponse, HttpResponseBadRequest
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

logger = logging.getLogger(__name__)


@require_POST
@csrf_exempt
def csp_report_collector(request):
    """
    Accepts the Content-Security-Policy violation reports generated via the `report-uri` feature:
    https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/report-uri

    This is written as a standard Django view rather than as a django-rest-framework APIView,
    since the latter ends up being more of a hindrance than a help, thanks to:
      * CSP violation reports being submitted with a Content-Type of `application/csp-report`,
        which d-r-f is unable to recognise as JSON without use of a custom parser class.
      * Needing to accept reports from unauthenticated users too, which requires overriding
        permission_classes.
    """
    try:
        report = json.loads(request.body)['csp-report']
    except (KeyError, TypeError, ValueError):
        return HttpResponseBadRequest('Invalid CSP violation report')

    logger.warning('CSP violation: %s', report)
    newrelic.agent.record_custom_event('CSP violation', report)
    return HttpResponse()
