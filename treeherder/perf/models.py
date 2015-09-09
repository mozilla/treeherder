from django.core.validators import MinLengthValidator
from django.db import models
from django.utils.encoding import python_2_unicode_compatible
from jsonfield import JSONField

from treeherder.model.models import (MachinePlatform,
                                     OptionCollection,
                                     Repository)

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
                                      db_index=True)

    repository = models.ForeignKey(Repository, null=True)  # null=True only temporary, until we update old entries
    framework = models.ForeignKey(PerformanceFramework)
    platform = models.ForeignKey(MachinePlatform)
    option_collection = models.ForeignKey(OptionCollection)
    suite = models.CharField(max_length=80L)
    test = models.CharField(max_length=80L, blank=True)
    lower_is_better = models.BooleanField(default=True)
    last_updated = models.DateTimeField(db_index=True, null=True)  # null=True only temporary, until we update old entries

    # extra properties to distinguish the test (that don't fit into
    # option collection for whatever reason)
    extra_properties = JSONField(max_length=1024)

    class Meta:
        db_table = 'performance_signature'
        # make sure there is only one signature per repository with a
        # particular set of properties
        unique_together = ('repository', 'framework', 'platform',
                           'option_collection', 'suite', 'test',
                           'last_updated')
        # make sure there is only one signature of any hash per
        # repository (same hash in different repositories is allowed)
        unique_together = ('repository', 'signature_hash')

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

    def save(self, *args, **kwargs):
        super(PerformanceDatum, self).save(*args, **kwargs)  # Call the "real" save() method.
        if not self.signature.last_updated or (self.signature.last_updated <
                                               self.push_timestamp):
            self.signature.last_updated = self.push_timestamp
            self.signature.save()

    def __str__(self):
        return "{} {}".format(self.value, self.push_timestamp)


@python_2_unicode_compatible
class PerformanceAlert(models.Model):

    id = models.AutoField(primary_key=True)
    repository = models.ForeignKey(Repository)
    prev_result_set_id = models.PositiveIntegerField()
    result_set_id = models.PositiveIntegerField()
    series_signature = models.ForeignKey(PerformanceSignature)
    regression = models.BooleanField()
    amount_pct = models.FloatField()
    amount_abs = models.FloatField()
    prev_value = models.FloatField()
    new_value = models.FloatField()
    t_value = models.FloatField()

    class Meta:
        db_table = "performance_alert"
        unique_together = ('repository', 'prev_result_set_id', 'result_set_id', 'series_signature')

    def __str__(self):
        return "{} {} {} {}%".format(self.repository, self.result_set_id,
                                     self.series_signature, self.amount_pct)


class PerformanceAlertSummary(models.Model):

    NEW = 0
    WONTFIX = 1
    BACKED_OUT = 2
    INVALID = 3
    BUGFILED = 4
    DUPLICATE = 5

    STATUSES = ((NEW, 'New'),
                (WONTFIX, 'Won\'t fix'),
                (BACKED_OUT, 'Backed out'),
                (INVALID, 'Invalid'),
                (BUGFILED, 'Bug filed'),
                (DUPLICATE, 'Duplicate'))

    id = models.AutoField(primary_key=True)
    status = models.IntegerField(choices=STATUSES, default=NEW)
    repository = models.ForeignKey(Repository)
    prev_result_set_id = models.PositiveIntegerField()
    result_set_id = models.PositiveIntegerField()
    bugzilla_id = models.PositiveIntegerField(null=True)

    last_updated = models.DateTimeField(db_index=True)

    # alerts generated directly from the summary
    generated_alerts = models.ManyToManyField(PerformanceAlert,
                                              related_name='generated_alerts')

    class Meta:
        db_table = "performance_alert_summary"
        unique_together = ('repository', 'prev_result_set_id', 'result_set_id')

    def __str__(self):
        return "{} {}".format(self.repository, self.result_set_id)
