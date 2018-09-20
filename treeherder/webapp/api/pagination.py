from django.core.paginator import Paginator
from django.utils.functional import cached_property
from rest_framework import pagination
from rest_framework.response import Response


class IdPagination(pagination.CursorPagination):
    ordering = ('-id')
    page_size = 100


# Django's Paginator class uses queryset.count() which
# performs a full table scan
class CustomPaginator(Paginator):
    def __init__(self, queryset, page_size):
        Paginator.__init__(self, queryset, page_size)

    @cached_property
    def count(self):
        return len(self.object_list)


class CustomPagePagination(pagination.PageNumberPagination):
    page_query_param = 'page'
    page_size = 20
    page_size_query_param = 'page_size'
    django_paginator_class = CustomPaginator

    def get_paginated_response(self, data):
        return Response({
            'total_pages': self.page.paginator.num_pages,
            'count': self.page.paginator.count,
            'results': data
        })
