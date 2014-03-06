from rest_framework.permissions import BasePermission
from rest_framework.permissions import SAFE_METHODS


class IsStaffOrReadOnly(BasePermission):
    """
    The request is authenticated as an admin staff (eg. sheriffs), or is a read-only request.
    """

    def has_permission(self, request, view):
        return (request.method in SAFE_METHODS or
            request.user and
            request.user.is_authenticated() and
            request.user.is_staff)