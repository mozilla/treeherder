from django.core.paginator import Paginator
from django.utils.functional import cached_property
from rest_framework import pagination


class IdPagination(pagination.CursorPagination):
    ordering = '-id'
    page_size = 100


# Django's Paginator class uses queryset.count() which
# performs a full table scan
class CustomPaginator(Paginator):
    def __init__(self, queryset, page_size):
        Paginator.__init__(self, queryset, page_size)

    @cached_property
    def count(self):
        return len(self.object_list)


class JobPagination(pagination.PageNumberPagination):
    page_size = 2000
    page_size_query_param = 'count'
    max_page_size = 2000
    django_paginator_class = CustomPaginator
