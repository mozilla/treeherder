from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.status import HTTP_404_NOT_FOUND

from treeherder.model.models import JobType, Push, Repository, InvestigatedTests
from treeherder.webapp.api.serializers import InvestigatedTestsSerializers


class InvestigatedViewSet(viewsets.ModelViewSet):
    """
    Handles creating, reading and deleting investigated tests
    """

    serializer_class = InvestigatedTestsSerializers
    allowed_methods = ['GET', 'POST', 'DELETE']

    def get_queryset(self):

        revision = self.request.GET['revision']
        project = self.kwargs['project']

        try:
            repository = Repository.objects.get(name=project)
            push = Push.objects.get(revision=revision, repository=repository)
            queryset = InvestigatedTests.objects.filter(push=push)
            return queryset

        except Push.DoesNotExist:
            return Response(
                "No push with revision: {0}".format(revision), status=HTTP_404_NOT_FOUND
            )

        except InvestigatedTests.DoesNotExist:
            return Response(
                "No push with revision: {0}".format(revision), status=HTTP_404_NOT_FOUND
            )

    def create(self, request, *args, **kwargs):
        project = kwargs['project']
        revision = request.query_params.get('revision')
        test = request.data['test']
        jobName = request.data['jobName']
        jobSymbol = request.data['jobSymbol']

        try:
            repository = Repository.objects.get(name=project)
            push = Push.objects.get(revision=revision, repository=repository)
            job_type = JobType.objects.get(name=jobName, symbol=jobSymbol)
            InvestigatedTests.objects.create(push=push, job_type=job_type, test=test)
            return Response('Investigated Test added', status=status.HTTP_201_CREATED)

        except Push.DoesNotExist:
            return Response(
                "No push with revision: {0}".format(revision), status=HTTP_404_NOT_FOUND
            )

        except JobType.DoesNotExist:
            return Response(
                "No JobType with job name: {0}".format(jobName), status=HTTP_404_NOT_FOUND
            )

    def destroy(self, request, project, pk=None):
        investigated_test = InvestigatedTests.objects.get(pk=pk)
        investigated_test.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
