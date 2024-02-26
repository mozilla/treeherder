import logging

from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from treeherder.model.models import FilesBugzillaMap
from treeherder.webapp.api import serializers

logger = logging.getLogger(__name__)


class FilesBugzillaMapViewSet(viewsets.ReadOnlyModelViewSet):
    def filter_product_component(self, queryset):
        filtered_queryset = []
        product = "bugzilla_component__product"
        component = "bugzilla_component__component"
        # Don't suggest these. While a file associated with one of these
        # combinations can be in the failure line, it might not be a test and
        # the real issue gets logged earlier but not detected as failure line.
        # Require user input for the product and component to use.
        ignore_list_product_component = [
            {product: "Testing", component: "Mochitest"},
        ]
        for product_component in queryset:
            if product_component not in ignore_list_product_component:
                filtered_queryset.append(product_component)
        return filtered_queryset[:5]

    @action(detail=True, methods=["get"])
    def get_queryset(self):
        """
        Gets a set of bug suggestions for this job
        """
        path = self.request.query_params.get("path")
        if path.startswith("org.mozilla."):
            path = (path.split("#"))[0]
            path = (path.split("."))[-1]
        path = path.replace("\\", "/")
        # Drop parameters
        path = (path.split("?"))[0]
        file = (path.split("/"))[-1]
        file_name_parts = file.split(".")
        file_without_extension = file_name_parts[0] + ("." if len(file_name_parts) > 1 else "")
        queryset = (
            FilesBugzillaMap.objects.select_related("bugzilla_component")
            .filter(path__endswith=path)
            .exclude(path__startswith="testing/web-platform/meta/")
            .values("bugzilla_component__product", "bugzilla_component__component")
            .distinct()
        )
        if len(queryset) == 0:
            # E.g. web-platform-tests ("wpt") can use test files generated from
            # other files which just have different file extensions.
            path_without_extension = (path.rsplit("/", 1))[0] + "/" + file_without_extension
            queryset = (
                FilesBugzillaMap.objects.select_related("bugzilla_component")
                .filter(path__contains=path_without_extension)
                .exclude(path__startswith="testing/web-platform/meta/")
                .values("bugzilla_component__product", "bugzilla_component__component")
                .distinct()
            )
        if len(queryset) > 0:
            return self.filter_product_component(queryset)
        queryset = (
            FilesBugzillaMap.objects.select_related("bugzilla_component")
            .filter(file_name=file)
            .values("bugzilla_component__product", "bugzilla_component__component")
            .distinct()
        )
        if len(queryset) > 0:
            return self.filter_product_component(queryset)
        queryset = (
            FilesBugzillaMap.objects.select_related("bugzilla_component")
            .filter(file_name__startswith=file_without_extension)
            .values("bugzilla_component__product", "bugzilla_component__component")
            .distinct()
        )
        return self.filter_product_component(queryset)

    serializer_class = serializers.FilesBugzillaMapSerializer

    def list(self, request, *args, **kwargs):
        resp = super().list(request, *args, **kwargs)
        return Response(resp.data)
