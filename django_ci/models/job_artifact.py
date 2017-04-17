from django.db import models

from django_ci.models import ActivableModel, DataIngestionManager, Job


class JobArtifact(ActivableModel):
    job = models.ForeignKey(Job)
    name = models.CharField(max_length=50, db_index=True)
    type = models.CharField(max_length=50, db_index=True)
    blob = models.TextField()
    url = models.URLField(blank=True, null=True)

    objects = DataIngestionManager()
