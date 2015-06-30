from django.db import models
from django.utils.encoding import python_2_unicode_compatible

from django_ci.models import ActivableModel, DataIngestionManager


@python_2_unicode_compatible
class BuildPlatform(ActivableModel):
    id = models.AutoField(primary_key=True)
    os_name = models.CharField(max_length=25L)
    platform = models.CharField(max_length=25L)
    architecture = models.CharField(max_length=25L, blank=True)

    objects = DataIngestionManager()

    def __str__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)
