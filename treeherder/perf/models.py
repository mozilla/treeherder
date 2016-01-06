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
    parents_signature = models.ForeignKey('self', null=True, blank=True)

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
class PerformanceAlertSummary(models.Model):
    '''
    A summarization of performance alerts

    A summary of "alerts" that the performance numbers for a specific
    repository have changed at a particular time.

    See also the :ref:`PerformanceAlert` class below.
    '''
    id = models.AutoField(primary_key=True)
    repository = models.ForeignKey(Repository)
    prev_result_set_id = models.PositiveIntegerField()
    result_set_id = models.PositiveIntegerField()

    last_updated = models.DateTimeField(db_index=True)

    class Meta:
        db_table = "performance_alert_summary"
        unique_together = ('repository', 'prev_result_set_id', 'result_set_id')

    def __str__(self):
        return "{} {}".format(self.repository, self.result_set_id)


@python_2_unicode_compatible
class PerformanceAlert(models.Model):
    '''
    A single performance alert

    An individual "alert" that the numbers in a specific performance
    series have consistently changed level at a specific time.

    An alert is always a member of an alert summary, which groups all
    the alerts associated with a particular result set and repository
    together. In many cases at Mozilla, the original alert summary is not
    correct, so we allow reassigning it to a different (revised) summary.
    '''
    id = models.AutoField(primary_key=True)
    summary = models.ForeignKey(PerformanceAlertSummary,
                                related_name='alerts')
    revised_summary = models.ForeignKey(PerformanceAlertSummary,
                                        related_name='revised_alerts',
                                        null=True)
    series_signature = models.ForeignKey(PerformanceSignature)
    is_regression = models.BooleanField()

    UNTRIAGED = 0
    INVALID = 1
    WONTFIX = 2
    INVESTIGATING = 3
    RESOLVED = 4
    DUPLICATE = 5

    STATUSES = ((UNTRIAGED, 'Untriaged'),
                (INVALID, 'Invalid'),
                (WONTFIX, 'Won\'t fix'),
                (RESOLVED, 'Resolved'),
                (INVESTIGATING, 'Investigating'),
                (DUPLICATE, 'Duplicate'))

    status = models.IntegerField(choices=STATUSES, default=UNTRIAGED)

    amount_pct = models.FloatField(
        help_text="Amount in percentage that series has changed")
    amount_abs = models.FloatField(
        help_text="Absolute amount that series has changed")
    prev_value = models.FloatField(
        help_text="Previous value of series before change")
    new_value = models.FloatField(
        help_text="New value of series after change")
    t_value = models.FloatField(
        help_text="t value out of analysis indicating confidence "
        "that change is 'real'")
    bug_number = models.PositiveIntegerField(null=True)

    def save(self, *args, **kwargs):
        # just a bit of extra business logic to make sure
        # the status corresponds with other metadata
        if self.revised_summary is not None:
            self.status = PerformanceAlert.DUPLICATE
        elif self.status == PerformanceAlert.DUPLICATE:
            self.status == PerformanceAlert.UNTRIAGED

        if self.bug_number is not None:
            if self.status == PerformanceAlert.UNTRIAGED:
                self.status = PerformanceAlert.INVESTIGATING
        elif self.status in (PerformanceAlert.WONTFIX,
                             PerformanceAlert.RESOLVED,
                             PerformanceAlert.INVESTIGATING):
            self.status = PerformanceAlert.UNTRIAGED

        super(PerformanceAlert, self).save(*args, **kwargs)

    class Meta:
        db_table = "performance_alert"
        unique_together = ('summary', 'series_signature')

    def __str__(self):
        return "{} {} {}%".format(self.summary, self.series_signature,
                                  self.amount_pct)
