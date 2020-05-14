import datetime
import logging
import time

from rest_framework import generics
from django.db.models import F
from treeherder.model import models

from .infra_serializers import InfraCompareSerializer, InfraCompareQuerySerializers

from rest_framework.response import Response
from rest_framework.status import HTTP_400_BAD_REQUEST


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class InfraCompareView(generics.ListAPIView):
    serializer_class = InfraCompareSerializer
    queryset = None

    def list(self, request):
        query_params = InfraCompareQuerySerializers(data=request.query_params)
        if not query_params.is_valid():
            return Response(data=query_params.errors, status=HTTP_400_BAD_REQUEST)

        startday = query_params.validated_data['startday']
        endday = query_params.validated_data['endday']
        project = query_params.validated_data['project']
        revision = query_params.validated_data['revision']
        interval = query_params.validated_data['interval']
        repository = models.Repository.objects.get(name=project)

        if revision:
            push = models.Push.objects.filter(repository=repository, revision=revision).first()
            jobs = models.Job.objects.filter(push=push)
        elif interval and not startday and not endday:
            # time.time() and interval are in seconds here
            jobs = models.Job.objects.filter(
                repository=repository,
                start_time__gt=datetime.datetime.utcfromtimestamp(int(time.time() - int(interval))),
            )
        else:
            jobs = models.Job.objects.filter(
                repository=repository, start_time__gt=startday, start_time__lt=endday
            )

        # division by 1000000 is done to convert it to seconds
        jobs = jobs.annotate(duration=(F('end_time') - F('start_time')) / 1000000)
        self.queryset = jobs.values("id", "job_type__name", "duration", "result")
        serializer = self.get_serializer(self.queryset, many=True)
        return Response(data=serializer.data)
