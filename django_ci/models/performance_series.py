from django.db import models

from django_ci.models import ActivableModel


class PerformanceSeries(ActivableModel):
    interval_seconds = models.IntegerField(db_index=True)
    series_signature = models.CharField(max_length=50, db_index=True)
    type = models.CharField(max_length=50, db_index=True)
    last_updated = models.IntegerField(db_index=True)
    blob = models.TextField()
