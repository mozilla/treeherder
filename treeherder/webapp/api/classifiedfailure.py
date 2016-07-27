from collections import defaultdict

import rest_framework_filters as filters
from rest_framework import viewsets
from rest_framework.decorators import detail_route
from rest_framework.response import Response
from rest_framework.status import (HTTP_200_OK,
                                   HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)

from treeherder.model.models import (ClassifiedFailure,
                                     FailureLine)
from treeherder.webapp.api import (pagination,
                                   serializers)
from treeherder.webapp.api.utils import as_dict


class ClassifiedFailureFilter(filters.FilterSet):
    class Meta(object):
        model = ClassifiedFailure
        fields = ["bug_number"]


class ClassifiedFailureViewSet(viewsets.ModelViewSet):
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
                return "No id provided", HTTP_400_BAD_REQUEST

            bug_number = item.get('bug_number')
            if bug_number is None:
                return "No bug number provided", HTTP_400_BAD_REQUEST

            bug_numbers[classified_failure_id] = int(bug_number)

        classified_failures = as_dict(
            ClassifiedFailure.objects.filter(id__in=bug_numbers.keys()), "id")

        existing = (ClassifiedFailure.objects
                    .filter(bug_number__in=bug_numbers.values())
                    .all())
        # Look for other classified failures with the same bug as one being updated, since
        # we don't want duplicate bugs
        existing = as_dict((item for item in existing
                            if item.id not in bug_numbers or
                            item.bug_number != bug_numbers[item.id]), "bug_number")

        # We don't count classified failures as missing if there is an existing failure
        # with the same bug number, even if it has a different id. This is because classification
        # of other jobs may have caused the classified failure to have been deleted and replaced
        # by another, without updating all the ids in the client
        missing = set(bug_numbers.keys()) - set(classified_failures.keys())
        replacements = {}
        for missing_id in missing:
            if bug_numbers[missing_id] in existing:
                existing_cf = existing[bug_numbers[missing_id]]
                replacements[missing_id] = existing_cf

        missing -= set(replacements.keys())

        if missing:
            return ("No classified failures with id: {0}"
                    .format(", ".join(str(item) for item in missing)),
                    HTTP_404_NOT_FOUND)

        if any(item.id in bug_numbers for item in existing.values()):
            return ("Cannot swap classified failure bug numbers in a single operation",
                    HTTP_400_BAD_REQUEST)

        classified_failures.update(as_dict(existing.values(), "id"))

        for old_id, replacement in replacements.iteritems():
            bug_numbers[replacement.id] = replacement
            del bug_numbers[old_id]

        merges = {}
        if existing:
            bug_to_classified_failure = defaultdict(list)
            for id, bug_number in bug_numbers.iteritems():
                bug_to_classified_failure[bug_number].append(classified_failures[id])
            # Merge the ClassifiedFailure being updated into the existing ClassifiedFailure
            # with the same bug number
            for bug_number, retain in existing.iteritems():
                for remove in bug_to_classified_failure[bug_number]:
                    removed_id = remove.id
                    remove.replace_with(retain)
                    merges[removed_id] = retain

        # Ensure that the return value is ordered in the same way as the request
        rv = []
        for item in data:
            classification_id = int(item.get("id"))

            if classification_id in merges:
                classification = merges[classification_id]
            elif classification_id in replacements:
                classification = replacements[classification_id]
            else:
                bug_number = bug_numbers[classification_id]
                classification = classified_failures[classification_id].set_bug(bug_number)
            rv.append(classification)

        if not many:
            rv = rv[0]

        return self.serializer_class(rv, many=many).data, HTTP_200_OK

    def update(self, request, pk=None):
        data = {"id": pk}
        for k, v in request.data.iteritems():
            if k not in data:
                data[k] = v

        body, status = self._update([data], many=False)
        return Response(body, status=status)

    def update_many(self, request):
        body, status = self._update(request.data, many=True)

        if status == HTTP_404_NOT_FOUND:
            # 404 doesn't make sense for updating many since the path is always
            # valid, so if we get an invalid id instead return 400
            status = HTTP_400_BAD_REQUEST

        return Response(body, status=status)

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
