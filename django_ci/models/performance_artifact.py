from django.db import models

from django_ci.models import ActivableModel, DataIngestionManager, Job


class PerformanceArtifact(ActivableModel):
    job = models.ForeignKey(Job)
    series_signature = models.CharField(max_length=50, db_index=True)
    name = models.CharField(max_length=50, db_index=True)
    type = models.CharField(max_length=50, db_index=True)
    blob = models.TextField()

    objects = DataIngestionManager()
