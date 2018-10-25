from rest_framework import pagination


class IdPagination(pagination.CursorPagination):
    ordering = ('-id')
    page_size = 100
