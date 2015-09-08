from django.core.validators import MinLengthValidator
from django.db import models
from django.utils.encoding import python_2_unicode_compatible
from jsonfield import JSONField

from treeherder.model.models import MachinePlatform, OptionCollection, Repository

SIGNATURE_HASH_LENGTH = 40L


@python_2_unicode_compatible
class PerformanceFramework(models.Model):

    name = models.SlugField(max_length=255L, unique=True)

    class Meta:
        db_table = 'performance_framework'

    def __str__(self):
        return self.name


@python_2_unicode_compatible
class PerformanceSignature(models.Model):

    signature_hash = models.CharField(max_length=SIGNATURE_HASH_LENGTH,
                                      validators=[
                                          MinLengthValidator(SIGNATURE_HASH_LENGTH)
                                      ],
                                      unique=True,
                                      db_index=True)

    framework = models.ForeignKey(PerformanceFramework)
    platform = models.ForeignKey(MachinePlatform)
    option_collection = models.ForeignKey(OptionCollection)
    suite = models.CharField(max_length=80L)
    test = models.CharField(max_length=80L, blank=True)

    # extra properties to distinguish the test (that don't fit into
    # option collection for whatever reason)
    extra_properties = JSONField(max_length=1024)

    class Meta:
        db_table = 'performance_signature'

    def __str__(self):
        return self.signature_hash


@python_2_unicode_compatible
class PerformanceDatum(models.Model):

    repository = models.ForeignKey(Repository)
    job_id = models.PositiveIntegerField(db_index=True)
    result_set_id = models.PositiveIntegerField(db_index=True)
    signature = models.ForeignKey(PerformanceSignature)
    value = models.FloatField()
    push_timestamp = models.DateTimeField(db_index=True)

    class Meta:
        db_table = 'performance_datum'
        index_together = [('repository', 'signature', 'push_timestamp'),
                          ('repository', 'job_id'),
                          ('repository', 'result_set_id')]
        unique_together = ('repository', 'job_id', 'result_set_id',
                           'signature', 'push_timestamp')

    def __str__(self):
        return "{} {}".format(self.datum, self.push_timestamp)
