from django.db import models
from django.utils.encoding import python_2_unicode_compatible


@python_2_unicode_compatible
class Bugscache(models.Model):
    id = models.AutoField(primary_key=True)
    status = models.CharField(max_length=64L, blank=True)
    resolution = models.CharField(max_length=64L, blank=True)
    summary = models.CharField(max_length=255L)
    crash_signature = models.TextField(blank=True)
    keywords = models.TextField(blank=True)
    os = models.CharField(max_length=64L, blank=True)
    modified = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return "{0}".format(self.id)
