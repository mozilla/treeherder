from django.db import models

from django_ci.models import (ActivableModel, FailureClassification, Job)


class JobNote(ActivableModel):
    job = models.ForeignKey(Job)
    failure_classification = models.ForeignKey(FailureClassification,
                                               db_index=True, blank=True, null=True)
    who = models.CharField(max_length=50, db_index=True)
    note = models.TextField(blank=True)
    note_timestamp = models.IntegerField(db_index=True)
