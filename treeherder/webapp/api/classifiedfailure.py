from collections import defaultdict

import rest_framework_filters as filters
from rest_framework import viewsets
from rest_framework.decorators import detail_route
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.models import (ClassifiedFailure,
                                     FailureLine,
                                     FailureMatch)
from treeherder.webapp.api import (pagination,
                                   serializers)
from treeherder.webapp.api.utils import as_dict


class ClassifiedFailureFilter(filters.FilterSet):
    class Meta(object):
        model = ClassifiedFailure
        fields = ["bug_number"]


class ClassifiedFailureViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)
    serializer_class = serializers.ClassifiedFailureSerializer
    queryset = ClassifiedFailure.objects.all()
    filter_class = ClassifiedFailureFilter
    pagination_class = pagination.IdPagination

    def _create(self, data, many=False):
        rv = []

        for item in data:
            bug = item.get('bug_number')
            if bug >= 0:
                obj, _ = ClassifiedFailure.objects.get_or_create(bug_number=bug)
            else:
                obj = ClassifiedFailure()
                obj.save()
            rv.append(obj)

        if not many:
            rv = rv[0]

        return self.serializer_class(rv, many=many).data

    def create(self, request):
        if isinstance(request.data, list):
            return Response(self._create(request.data, many=True))

        return Response(self._create([request.data], many=False))

    def _update(self, data, many=False):
        bug_numbers = {}

        for item in data:
            classified_failure_id = int(item.get("id"))
            if classified_failure_id is None:
                return "No id provided", 400

            bug_number = item.get('bug_number')
            if bug_number is None:
                return "No bug number provided", 400

            bug_numbers[classified_failure_id] = int(bug_number)

        classified_failures = as_dict(
            ClassifiedFailure.objects.filter(id__in=bug_numbers.keys()), "id")

        if len(classified_failures) != len(bug_numbers):
            missing = set(bug_numbers.keys()) - set(classified_failures.keys())
            return "No classified failures with id: {0}".format(", ".join(missing)), 404

        merges = {}
        existing = ClassifiedFailure.objects.filter(bug_number__in=bug_numbers.values()).all()
        # Look for other classified failures with the same bug as one being updated, since
        # we don't want duplicate bugs
        existing = [item for item in existing
                    if item.id not in bug_numbers or item.bug_number != bug_numbers[item.id]]

        if existing:
            if any(item.id in bug_numbers for item in existing):
                return "Cannot swap classified failure bug numbers in a single operation", 400

            classified_failures.update(as_dict(existing, "id"))

            bug_to_id = defaultdict(list)
            for id, bug in bug_numbers.iteritems():
                bug_to_id[bug].append(id)
            # Merge the ClassifiedFailure being updated into the existing ClassifiedFailure
            # with the same bug number
            for item in existing:
                new_id = item.id
                for old_id in bug_to_id[item.bug_number]:
                    FailureLine.objects.filter(best_classification__id=old_id).update(
                        best_classification=new_id)
                    FailureMatch.objects.filter(classified_failure__id=old_id).update(
                        classified_failure=new_id)
                    ClassifiedFailure.objects.filter(id=old_id).delete()
                    merges[old_id] = new_id

        # Ensure that the return value is ordered in the same way as the request
        rv = []
        for item in data:
            classification_id = int(item.get("id"))
            bug_number = bug_numbers[classification_id]
            if classification_id in merges:
                obj = classified_failures[merges[classification_id]]
            else:
                obj = classified_failures[classification_id]
                obj.bug_number = bug_number
                obj.save()
            rv.append(obj)

        if not many:
            rv = rv[0]

        return self.serializer_class(rv, many=many).data, 200

    def update(self, request, pk=None):
        data = {"id": pk}
        for k, v in request.data.iteritems():
            if k not in data:
                data[k] = v

        return Response(*self._update([data], many=False))

    def update_many(self, request):
        body, status = self._update(request.data, many=True)

        if status == 404:
            status = 400

        return Response(body, status)

    @detail_route(methods=['get'])
    def matches(self, request, pk=None):
        serializer_class = serializers.FailureLineNoStackSerializer

        queryset = FailureLine.objects.filter(
            best_classification__id=pk).prefetch_related('matches').all()
        page = self.paginate_queryset(queryset)

        if page:
            serializer = serializer_class(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = serializer_class(queryset, many=True)
        return Response(serializer.data)
