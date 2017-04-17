from django.db import models
from django.utils.encoding import python_2_unicode_compatible

from django_ci.models import Option, DataIngestionManager


@python_2_unicode_compatible
class OptionCollection(models.Model):
    id = models.AutoField(primary_key=True)
    option_collection_hash = models.CharField(max_length=40L)
    option = models.ForeignKey(Option)

    objects = DataIngestionManager()

    class Meta:
        unique_together = ['option_collection_hash', 'option']

    def __str__(self):
        return "{0}".format(self.option)
