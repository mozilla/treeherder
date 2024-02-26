from django.db import IntegrityError
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND, HTTP_400_BAD_REQUEST

from treeherder.model.models import JobType, Push, Repository, InvestigatedTests
from treeherder.webapp.api.serializers import InvestigatedTestsSerializers


class InvestigatedViewSet(viewsets.ModelViewSet):
    """
    Handles creating, reading and deleting investigated tests
    """

    serializer_class = InvestigatedTestsSerializers
    allowed_methods = ["GET", "POST", "DELETE"]

    def get_queryset(self):
        revision = self.request.GET["revision"]
        project = self.kwargs["project"]

        try:
            repository = Repository.objects.get(name=project)
            push = Push.objects.get(revision=revision, repository=repository)
            queryset = InvestigatedTests.objects.filter(push=push)
            return queryset

        except Push.DoesNotExist:
            return Response(f"No push with revision: {revision}", status=HTTP_404_NOT_FOUND)

        except InvestigatedTests.DoesNotExist:
            return Response(f"No push with revision: {revision}", status=HTTP_404_NOT_FOUND)

    def create(self, request, *args, **kwargs):
        project = kwargs["project"]
        revision = request.query_params.get("revision")
        test = request.data["test"]
        job_name = request.data["jobName"]
        job_symbol = request.data["jobSymbol"]

        try:
            repository = Repository.objects.get(name=project)
            push = Push.objects.get(revision=revision, repository=repository)
            job_type = JobType.objects.get(name=job_name, symbol=job_symbol)
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(push=push, job_type=job_type, test=test)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except IntegrityError:
            return Response(f"{test} already marked investigated", status=HTTP_400_BAD_REQUEST)

        except Push.DoesNotExist:
            return Response(f"No push with revision: {revision}", status=HTTP_404_NOT_FOUND)

        except JobType.DoesNotExist:
            return Response(f"No JobType with job name: {job_name}", status=HTTP_404_NOT_FOUND)

    def destroy(self, request, project, pk=None):
        try:
            investigated_test = InvestigatedTests.objects.get(pk=pk)
            investigated_test.delete()
            return Response(
                status=status.HTTP_204_NO_CONTENT,
            )

        except InvestigatedTests.DoesNotExist:
            return Response("Test already uninvestigated", status=HTTP_404_NOT_FOUND)
