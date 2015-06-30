from django.db import models

from django_ci.models import (ActivableModel, DataIngestionManager,
                              Repository, Revision)


class ResultSet(ActivableModel):
    revision_hash = models.CharField(unique=True, max_length=50)
    author = models.CharField(max_length=150, db_index=True)
    push_timestamp = models.IntegerField(db_index=True)
    revisions = models.ManyToManyField(Revision, related_name='result_sets')
    repository = models.ForeignKey(Repository)

    objects = DataIngestionManager()
