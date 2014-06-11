from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.authentication import SessionAuthentication
from treeherder.webapp.api.permissions import IsStaffOrReadOnly

from treeherder.model.derived import JobsModel


class LogUrlViewset(viewsets.ViewSetw):
    authentication_classes = (SessionAuthentication,)
    permission_classes = (IsStaffOrReadOnly,)

    def

