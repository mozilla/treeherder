from django.db import models
from django.utils.encoding import python_2_unicode_compatible

from django_ci.models import ActivableModel


@python_2_unicode_compatible
class Repository(ActivableModel):
    id = models.AutoField(primary_key=True)
    repository_group = models.ForeignKey('RepositoryGroup')
    name = models.CharField(max_length=50L)
    dvcs_type = models.CharField(max_length=25L)
    url = models.CharField(max_length=255L)
    codebase = models.CharField(max_length=50L, blank=True)
    description = models.TextField(blank=True, default='fill me')

    def __str__(self):
        return "{0} {1}".format(
            self.name, self.repository_group)
