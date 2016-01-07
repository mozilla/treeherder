from collections import defaultdict

from django.db import transaction
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.derived import JobsModel
from treeherder.model.models import (ClassifiedFailure,
                                     FailureLine,
                                     FailureMatch,
                                     Matcher)
from treeherder.webapp.api import serializers
from treeherder.webapp.api.utils import as_dict


class FailureLineViewSet(viewsets.ViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)

    def retrieve(self, request, pk=None):
        """
        Get a single test failure line
        """
        try:
            failure_line = FailureLine.objects.prefetch_related(
                "matches", "matches__matcher",
            ).get(id=pk)
            return Response(serializers.FailureLineNoStackSerializer(failure_line).data)
        except FailureLine.DoesNotExist:
            return Response("No job with id: {0}".format(pk), 404)

    @transaction.atomic
    def _update(self, data, email, many=True):
        by_project = defaultdict(list)

        ids = []
        failure_line_ids = set()
        classification_ids = set()

        for item in data:
            line_id = int(item.get("id"))
            if line_id is None:
                return "No failure line id provided", 400

            failure_line_ids.add(line_id)

            if "best_classification" not in item:
                return "No classification id provided", 400

            classification_id = item.get("best_classification")

            if classification_id is not None:
                classification_ids.add(classification_id)

            ids.append((line_id, classification_id))

        failure_lines = as_dict(
            FailureLine.objects.prefetch_related('classified_failures').filter(
                id__in=failure_line_ids), "id")

        if len(failure_lines) != len(failure_line_ids):
            missing = failure_line_ids - set(failure_lines.keys())
            return "No failure line with id: {0}".format(", ".join(missing)), 404

        classifications = as_dict(
            ClassifiedFailure.objects.filter(id__in=classification_ids), "id")

        if len(classifications) != len(classification_ids):
            missing = classification_ids - set(classifications.keys())
            return "No classification with id: {0}".format(", ".join(missing)), 404

        for line_id, classification_id in ids:
            failure_line = failure_lines[line_id]
            if classification_id is not None:
                classification = classifications[classification_id]
            else:
                classification = None

            by_project[failure_line.repository.name].append(failure_line.job_guid)

            failure_line.best_classification = classification
            failure_line.best_is_verified = True
            failure_line.save()

            if (classification is not None and
                classification not in failure_line.classified_failures.all()):
                manual_detector = Matcher.objects.get(name="ManualDetector")
                match = FailureMatch(failure_line=failure_line,
                                     classified_failure=classification,
                                     matcher=manual_detector,
                                     score=1.0)
                match.save()

        for project, job_guids in by_project.iteritems():
            with JobsModel(project) as jm:
                jobs = jm.get_job_ids_by_guid(job_guids)
                for job in jobs.values():
                    jm.update_after_verification(job["id"], email)

        # Force failure line to be reloaded, including .classified_failures
        rv = FailureLine.objects.prefetch_related('classified_failures').filter(
            id__in=failure_line_ids)

        if not many:
            rv = rv[0]

        return serializers.FailureLineNoStackSerializer(rv, many=many).data, 200

    def update(self, request, pk=None):
        data = {"id": pk}
        for k, v in request.data.iteritems():
            if k not in data:
                data[k] = v

        return Response(*self._update([data], request.user.email, many=False))

    def update_many(self, request):
        body, status = self._update(request.data, request.user.email, many=True)

        if status == 404:
            status = 400

        return Response(body, status)
