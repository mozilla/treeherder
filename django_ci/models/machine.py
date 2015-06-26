from django.db import models
from django.utils.encoding import python_2_unicode_compatible

from django_ci.models import ActivableModel


@python_2_unicode_compatible
class Machine(ActivableModel):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=50L)
    first_timestamp = models.IntegerField()
    last_timestamp = models.IntegerField()

    def __str__(self):
        return self.name
