from django.db import models

from django_ci.models import ActivableModel, DataIngestionManager, Repository


class Revision(ActivableModel):
    revision = models.CharField(max_length=50)
    author = models.CharField(max_length=150, db_index=True)
    comments = models.TextField(blank=True)
    commit_timestamp = models.IntegerField(blank=True, null=True,
                                           db_index=True)
    files = models.TextField(blank=True)
    repository = models.ForeignKey(Repository)

    objects = DataIngestionManager()

    class Meta:
        unique_together = (('revision', 'repository'))
