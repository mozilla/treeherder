from django.core.validators import RegexValidator
from django.db import models
from django.utils.encoding import python_2_unicode_compatible
from jsonfield import JSONField

from treeherder.model.models import MachinePlatform, OptionCollection, Repository


@python_2_unicode_compatible
class PerformanceFramework(models.Model):
    name = models.SlugField(max_length=255L, unique=True)
    description = models.TextField()
    url = models.URLField()

    class Meta:
        db_table = 'performance_framework'

    def __str__(self):
        return self.name


@python_2_unicode_compatible
class PerformanceSignature(models.Model):

    signature_hash = models.CharField(max_length=40L,
                                      validators=[
                                          RegexValidator(
                                              regex='^.{40}$',
                                              message='Length has to be 40',
                                              code='nomatch')],
                                      db_index=True)

    framework = models.ForeignKey(PerformanceFramework)
    platform = models.ForeignKey(MachinePlatform)
    option_collection = models.ForeignKey(OptionCollection)
    suite = models.CharField(max_length=80L)
    test = models.CharField(max_length=80L, blank=True)

    # should be *only* what is needed to uniquely identify the
    # performance signature
    extra_properties = JSONField(max_length=1024)

    class Meta:
        db_table = 'performance_signature'

    def __str__(self):
        return self.uuid


@python_2_unicode_compatible
class PerformanceDatum(models.Model):

    repository = models.ForeignKey(Repository)
    job_id = models.PositiveIntegerField(db_index=True)
    result_set_id = models.PositiveIntegerField(db_index=True)
    signature = models.ForeignKey(PerformanceSignature)
    datum = JSONField(max_length=1024)
    push_timestamp = models.DateTimeField(db_index=True)

    class Meta:
        db_table = 'performance_datum'
        index_together = [('repository', 'signature', 'push_timestamp'),
                          ('repository', 'job_id'),
                          ('repository', 'result_set_id')]

    def __str__(self):
        return "{} {}".format(self.datum, self.push_timestamp)
