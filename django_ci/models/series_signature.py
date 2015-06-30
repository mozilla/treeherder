from django.db import models

from django_ci.models import ActivableModel, DataIngestionManager


class SeriesSignature(ActivableModel):
    signature = models.CharField(max_length=50, db_index=True)
    property = models.CharField(max_length=50, db_index=True)
    value = models.TextField()

    objects = DataIngestionManager()
