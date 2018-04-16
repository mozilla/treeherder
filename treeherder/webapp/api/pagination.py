from rest_framework import pagination
from rest_framework.response import Response


class IdPagination(pagination.CursorPagination):
    ordering = ('-id')
    page_size = 100


class CustomPagePagination(pagination.PageNumberPagination):
    page_query_param = 'page'
    page_size = 20
    page_size_query_param = 'page_size'

    def get_paginated_response(self, data):
        return Response({
            'total_pages': self.page.paginator.num_pages,
            'count': self.page.paginator.count,
            'results': data
        })
