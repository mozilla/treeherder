from collections import defaultdict

import rest_framework_filters as filters
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticatedOrReadOnly
from rest_framework.response import Response

from treeherder.model.derived import JobsModel
from treeherder.model.models import TextLogSummaryLine
from treeherder.webapp.api import (pagination,
                                   serializers)


class TextLogSummaryLineFilter(filters.FilterSet):
    class Meta(object):
        model = TextLogSummaryLine
        fields = ["bug_number"]


class TextLogSummaryLineViewSet(viewsets.ModelViewSet):
    permission_classes = (IsAuthenticatedOrReadOnly,)
    serializer_class = serializers.TextLogSummaryLineSerializer
    queryset = TextLogSummaryLine.objects.all()
    filter_class = TextLogSummaryLineFilter
    pagination_class = pagination.IdPagination

    def _update(self, data, email, many=False):
        line_ids = []
        for item in data:
            line_id = item.get("id")
            if line_id is None:
                return "No id provided", 400

            line_ids.append(int(line_id))

            if "bug_number" not in item:
                return "No bug number provided", 400

        rv = []
        objs = TextLogSummaryLine.objects.filter(id__in=line_ids).all()
        lines_by_id = {obj.id: obj for obj in objs}

        if len(objs) != len(lines_by_id):
            return "Line id(s) %s do not exist" % (",".join(item for item in line_ids
                                                            if item not in lines_by_id)), 400

        if len(lines_by_id) != len(line_ids):
            return "Got duplicate line ids", 400

        by_project = defaultdict(list)

        for line in data:
            line_id = int(line.get("id"))
            obj = lines_by_id[line_id]
            obj.bug_number = line.get("bug_number")
            obj.verified = line.get("verified", False)
            obj.save()
            summary = obj.summary
            by_project[summary.repository.name].append(summary.job_guid)
            rv.append(obj)

        for project, job_guids in by_project.iteritems():
            with JobsModel(project) as jm:
                jobs = jm.get_job_ids_by_guid(job_guids)
                for job in jobs.values():
                    jm.update_after_verification(job["id"], email)

        if not many:
            rv = rv[0]

        return self.serializer_class(rv, many=many).data, 200

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
