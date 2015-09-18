import jsonschema

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import list_route

from treeherder.etl.schema import IngestionDataSchema


class ArtifactViewSet(viewsets.ViewSet):

    """
    ViewSet for validating some possible Job artifacts against a schema

    """

    @list_route()
    def definition(self, request):
        """
        JSON schema definition for artifacts

        """
        try:
            name = request.query_params["name"]
            if name == "text_log_summary":
                return Response(
                    IngestionDataSchema().text_log_summary_artifact_json_schema)
            else:
                return Response(
                    "No schema available for artifact name: '{}'".format(name),
                    404)

        except KeyError:
            return Response("'name' parameter required", 400)

    @list_route(methods=["post"])
    def validate(self, request):
        """
        validate a JSON blob against the schema
        """

        try:
            name = request.data["name"]
            if name == "text_log_summary":
                jsonschema.validate(
                    request.data,
                    IngestionDataSchema().text_log_summary_artifact_json_schema)
                return Response("Schema validation passed")

            else:
                return Response(("JSON is valid.  "
                                 "But no schema exists for this artifact name"))

        except (jsonschema.ValidationError, jsonschema.SchemaError) as e:
            return Response(data=e, status=400)
