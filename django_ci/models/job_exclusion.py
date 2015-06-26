from django.contrib.auth.models import User
from django.db import models
from django.utils.encoding import python_2_unicode_compatible

from jsonfield import JSONField


@python_2_unicode_compatible
class JobExclusion(models.Model):

    """
    A filter represents a collection of properties
    that you want to filter jobs on. These properties along with their values
    are kept in the info field in json format
    """
    name = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    info = JSONField()
    author = models.ForeignKey(User)

    def save(self, *args, **kwargs):
        super(JobExclusion, self).save(*args, **kwargs)

        # trigger the save method on all the profiles related to this exclusion
        for profile in self.profiles.all():
            profile.save()

    def __str__(self):
        return self.name
