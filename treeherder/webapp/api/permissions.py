from mohawk import Receiver
from rest_framework import permissions


class IsStaffOrReadOnly(permissions.BasePermission):

    """
    The request is authenticated as an admin staff (eg. sheriffs), or is a read-only request.
    """

    def has_permission(self, request, view):
        return (request.method in permissions.SAFE_METHODS or
                request.user and request.user.is_staff)


class HasHawkPermissionsOrReadOnly(permissions.BasePermission):

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        hawk_header = request.META.get('hawk.receiver')
        return hawk_header and isinstance(hawk_header, Receiver)
