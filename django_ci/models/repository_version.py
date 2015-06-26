from django.db import models
from django.utils.encoding import python_2_unicode_compatible

from django_ci.models import ActivableModel


@python_2_unicode_compatible
class RepositoryVersion(ActivableModel):
    id = models.AutoField(primary_key=True)
    repository = models.ForeignKey('Repository')
    version = models.CharField(max_length=50L)
    version_timestamp = models.IntegerField()

    def __str__(self):
        return "{0} version {1}".format(
            self.repository, self.version)
