from django.conf import settings
from mohawk import Receiver
from rest_framework import permissions

from treeherder.webapp.api.exceptions import DownForMaintenance


class IsStaffOrReadOnly(permissions.BasePermission):

    """
    The request is authenticated as an admin staff (eg. sheriffs), or is a read-only request.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        # Prevent any non-read-only Django-auth based requests to the API.
        raise DownForMaintenance()


class IsOwnerOrReadOnly(permissions.BasePermission):

    """
    Object-level permission to only allow owners of an object to edit it.
    Assumes the model instance has an `user` attribute.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Prevent any non-read-only Django-auth based requests to the API.
        raise DownForMaintenance()


class HasHawkPermissions(permissions.BasePermission):

    def has_permission(self, request, view):
        hawk_header = request.META.get('hawk.receiver')

        if hawk_header and isinstance(hawk_header, Receiver):
            # Return an HTTP503 for third party submitters to our API, but
            # allow Treeherder's own ETL processes to submit, so that the
            # log parser/bug suggestions/... queues can empty out.
            if hawk_header.parsed_header.get('id') == settings.ETL_CLIENT_ID:
                return True
            raise DownForMaintenance()

        return False


class HasHawkPermissionsOrReadOnly(permissions.BasePermission):

    def has_permission(self, request, view):

        if request.method in permissions.SAFE_METHODS:
            return True

        return HasHawkPermissions().has_permission(request, view)
