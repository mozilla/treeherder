# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from rest_framework import exceptions
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exc_handler
from django.conf import settings

from treeherder.model.derived import DatasetNotFoundError, ObjectNotFoundException
import logging


logger = logging.getLogger(__name__)


class ResourceNotFoundException(exceptions.APIException):
    status_code = 404
    default_detail = "Resource not found"


def exception_handler(exc):
    """
Add treeherder-specific exception handling to the rest framework
Mostly a conversion of treeherders ORM exceptions to drf APIExceptions
"""
    import traceback
    full_message = traceback.format_exc()
    logger.error(exc)
    logger.error(full_message)

    if isinstance(exc, DatasetNotFoundError):
        exc = ResourceNotFoundException(
            "No project with name {0}".format(exc.project)
        )
    if isinstance(exc, ObjectNotFoundException):
        exc = ResourceNotFoundException(
            "{0} object not found using: {1}".format(
                exc.table, unicode(exc.extra_info)))

    response = drf_exc_handler(exc)
    if response is None:
        msg = {"detail": unicode(exc)}
        if settings.DEBUG:
            msg["traceback"] = full_message
        response = Response(msg, status=500)
    return response
