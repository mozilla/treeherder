from collections import defaultdict

from django.db import transaction
from rest_framework import (mixins,
                            viewsets)
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response
from rest_framework.status import (HTTP_200_OK,
                                   HTTP_400_BAD_REQUEST,
                                   HTTP_404_NOT_FOUND)

from treeherder.model.derived import JobsModel
from treeherder.model.models import (ClassifiedFailure,
                                     FailureLine)
from treeherder.webapp.api import serializers
from treeherder.webapp.api.utils import as_dict


class FailureLineViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)
    queryset = FailureLine.objects.prefetch_related("matches", "matches__matcher").all()
    serializer_class = serializers.FailureLineNoStackSerializer

    @transaction.atomic
    def _update(self, data, user, many=True):
        by_project = defaultdict(list)

        ids = []
        failure_line_ids = set()
        classification_ids = set()

        for item in data:
            line_id = int(item.get("id"))
            if line_id is None:
                return "No failure line id provided", HTTP_400_BAD_REQUEST

            failure_line_ids.add(line_id)

            if "best_classification" not in item:
                return "No classification id provided", HTTP_400_BAD_REQUEST

            classification_id = item.get("best_classification")

            if classification_id is not None:
                classification_ids.add(classification_id)

            ids.append((line_id, classification_id))

        failure_lines = as_dict(
            FailureLine.objects.prefetch_related('classified_failures').filter(
                id__in=failure_line_ids), "id")

        if len(failure_lines) != len(failure_line_ids):
            missing = failure_line_ids - set(failure_lines.keys())
            return ("No failure line with id: {0}".format(", ".join(missing)),
                    HTTP_404_NOT_FOUND)

        classifications = as_dict(
            ClassifiedFailure.objects.filter(id__in=classification_ids), "id")

        if len(classifications) != len(classification_ids):
            missing = classification_ids - set(classifications.keys())
            return ("No classification with id: {0}".format(", ".join(missing)),
                    HTTP_404_NOT_FOUND)

        for line_id, classification_id in ids:
            failure_line = failure_lines[line_id]
            if classification_id is not None:
                classification = classifications[classification_id]
            else:
                classification = None

            by_project[failure_line.repository.name].append(failure_line.job_guid)

            failure_line.mark_best_classification_verified(classification)

        for project, job_guids in by_project.iteritems():
            with JobsModel(project) as jm:
                jobs = jm.get_job_ids_by_guid(job_guids)
                for job in jobs.values():
                    jm.update_after_verification(job["id"], user)

        # Force failure line to be reloaded, including .classified_failures
        rv = FailureLine.objects.prefetch_related('classified_failures').filter(
            id__in=failure_line_ids)

        if not many:
            rv = rv[0]

        return (serializers.FailureLineNoStackSerializer(rv, many=many).data,
                HTTP_200_OK)

    def update(self, request, pk=None):
        data = {"id": pk}
        for k, v in request.data.iteritems():
            if k not in data:
                data[k] = v

        body, status = self._update([data], request.user, many=False)
        return Response(body, status=status)

    def update_many(self, request):
        body, status = self._update(request.data, request.user, many=True)

        if status == HTTP_404_NOT_FOUND:
            # 404 doesn't make sense for updating many since the path is always
            # valid, so if we get an invalid id instead return 400
            status = HTTP_400_BAD_REQUEST

        return Response(body, status=status)
