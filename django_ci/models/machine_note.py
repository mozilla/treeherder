from django.db import models
from django.utils.encoding import python_2_unicode_compatible

from django_ci.models import ActivableModel, Machine


@python_2_unicode_compatible
class MachineNote(ActivableModel):
    id = models.AutoField(primary_key=True)
    machine = models.ForeignKey(Machine)
    author = models.CharField(max_length=50L)
    machine_timestamp = models.IntegerField()
    note = models.TextField(blank=True)

    def __str__(self):
        return "Note {0} on {1} by {2}".format(
            self.id, self.machine, self.author)
