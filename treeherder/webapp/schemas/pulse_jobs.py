import jsonschema

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import list_route

from treeherder.etl.schema import IngestionDataSchema


class PulseJobsViewSet(viewsets.ViewSet):

    """
    This viewset is responsible for the jobs endpoint.

    """

    @list_route()
    def definition(self, request):
        """
        GET method JSON schema for pulse jobs

        """
        return Response(IngestionDataSchema().job_json_schema)

    @list_route(methods=["post"])
    def validate(self, request):
        """
        validate a JSON blob against the schema
        """

        try:
            jsonschema.validate(
                request.data,
                IngestionDataSchema().job_json_schema
            )
            return Response("Schema validation passed")

        except (jsonschema.ValidationError, jsonschema.SchemaError) as e:
            return Response(data=e, status=400)
