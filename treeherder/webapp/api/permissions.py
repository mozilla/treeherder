from mohawk import Receiver
from rest_framework import permissions


class IsStaffOrReadOnly(permissions.BasePermission):

    """
    The request is authenticated as an admin staff (eg. sheriffs), or is a read-only request.
    """

    def has_permission(self, request, view):
        return (request.method in permissions.SAFE_METHODS or
                request.user and request.user.is_staff)


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

        # Instance must have an attribute named `user`.
        return obj.user == request.user


class HasHawkPermissionsOrReadOnly(permissions.BasePermission):

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True

        hawk_header = request.META.get('hawk.receiver')
        return hawk_header and isinstance(hawk_header, Receiver)
