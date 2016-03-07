from django.core.exceptions import ValidationError
from django.core.validators import MinLengthValidator
from django.db import models
from django.utils.encoding import python_2_unicode_compatible
from jsonfield import JSONField

from treeherder.model.models import (MachinePlatform,
                                     OptionCollection,
                                     Repository)

SIGNATURE_HASH_LENGTH = 40


@python_2_unicode_compatible
class PerformanceFramework(models.Model):

    name = models.SlugField(max_length=255, unique=True)

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
    suite = models.CharField(max_length=80)
    test = models.CharField(max_length=80, blank=True)
    lower_is_better = models.BooleanField(default=True)
    last_updated = models.DateTimeField(db_index=True, null=True)  # null=True only temporary, until we update old entries
    parent_signature = models.ForeignKey('self', null=True, blank=True)
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
        name = self.suite
        if self.test:
            name += " {}".format(self.test)
        else:
            name += " summary"
        return "{} {} {} {}".format(self.signature_hash, name, self.platform,
                                    self.last_updated)


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
    framework = models.ForeignKey(PerformanceFramework, null=True)
    prev_result_set_id = models.PositiveIntegerField(null=True)
    result_set_id = models.PositiveIntegerField()

    last_updated = models.DateTimeField(db_index=True)

    UNTRIAGED = 0
    DOWNSTREAM = 1
    REASSIGNED = 2
    INVALID = 3
    IMPROVEMENT = 4
    INVESTIGATING = 5
    WONTFIX = 6
    FIXED = 7
    BACKED_OUT = 8

    STATUSES = ((UNTRIAGED, 'Untriaged'),
                (DOWNSTREAM, 'Downstream'),
                (INVALID, 'Invalid'),
                (IMPROVEMENT, 'Improvement'),
                (INVESTIGATING, 'Investigating'),
                (WONTFIX, 'Won\'t fix'),
                (FIXED, 'Fixed'),
                (BACKED_OUT, 'Backed out'))

    status = models.IntegerField(choices=STATUSES, default=UNTRIAGED)

    bug_number = models.PositiveIntegerField(null=True)

    def update_status(self):
        autodetermined_status = self.autodetermine_status()
        if autodetermined_status != self.status:
            self.status = autodetermined_status
            self.save()

    def autodetermine_status(self):
        alerts = (PerformanceAlert.objects.filter(summary=self) |
                  PerformanceAlert.objects.filter(related_summary=self))

        # if no alerts yet, we'll say untriaged
        if len(alerts) == 0:
            return PerformanceAlertSummary.UNTRIAGED

        # if any untriaged, then set to untriaged
        if len([a for a in alerts if a.status == PerformanceAlert.UNTRIAGED]):
            return PerformanceAlertSummary.UNTRIAGED

        # if all invalid, then set to invalid
        if all([alert.status == PerformanceAlert.INVALID for alert in
                alerts]):
            return PerformanceAlertSummary.INVALID

        # otherwise filter out invalid alerts
        alerts = [a for a in alerts if a.status != PerformanceAlert.INVALID]

        # if there are any "acknowledged" alerts, then set to investigating
        # if not one of the resolved statuses and there are regressions,
        # otherwise we'll say it's an improvement
        if len([a for a in alerts if a.status == PerformanceAlert.ACKNOWLEDGED]):
            if all([not alert.is_regression for alert in alerts]):
                return PerformanceAlertSummary.IMPROVEMENT
            elif self.status not in (PerformanceAlertSummary.IMPROVEMENT,
                                     PerformanceAlertSummary.INVESTIGATING,
                                     PerformanceAlertSummary.WONTFIX,
                                     PerformanceAlertSummary.FIXED,
                                     PerformanceAlertSummary.BACKED_OUT):
                return PerformanceAlertSummary.INVESTIGATING
            # keep status if one of the investigating ones
            return self.status

        # at this point, we've determined that this is a summary with no valid
        # alerts of its own: all alerts should be either reassigned,
        # downstream, or invalid (but not all invalid, that case is covered
        # above)
        if len([a for a in alerts if a.status == PerformanceAlert.REASSIGNED]):
            return PerformanceAlertSummary.REASSIGNED

        return PerformanceAlertSummary.DOWNSTREAM

    class Meta:
        db_table = "performance_alert_summary"
        unique_together = ('repository', 'framework', 'prev_result_set_id',
                           'result_set_id')

    def __str__(self):
        return "{} {} {}-{}".format(self.framework, self.repository,
                                    self.prev_result_set_id, self.result_set_id)


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
    related_summary = models.ForeignKey(PerformanceAlertSummary,
                                        related_name='related_alerts',
                                        null=True)
    series_signature = models.ForeignKey(PerformanceSignature)
    is_regression = models.BooleanField()

    UNTRIAGED = 0
    DOWNSTREAM = 1
    REASSIGNED = 2
    INVALID = 3
    ACKNOWLEDGED = 4

    # statuses where we relate this alert to another summary
    RELATIONAL_STATUS_IDS = (DOWNSTREAM, REASSIGNED)
    # statuses where this alert is related only to the summary it was
    # originally assigned to
    UNRELATIONAL_STATUS_IDS = (UNTRIAGED, INVALID, ACKNOWLEDGED)

    STATUSES = ((UNTRIAGED, 'Untriaged'),
                (DOWNSTREAM, 'Downstream'),
                (REASSIGNED, 'Reassigned'),
                (INVALID, 'Invalid'),
                (ACKNOWLEDGED, 'Acknowledged'))

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

    def save(self, *args, **kwargs):
        # validate that we set a status that makes sense for presence
        # or absence of a related summary
        if self.related_summary and self.status not in self.RELATIONAL_STATUS_IDS:
            raise ValidationError("Related summary set but status not in "
                                  "'{}'!".format(", ".join(
                                      [STATUS[1] for STATUS in self.STATUSES if
                                       STATUS[0] in self.RELATIONAL_STATUS_IDS])))
        if not self.related_summary and self.status not in self.UNRELATIONAL_STATUS_IDS:
            raise ValidationError("Related summary not set but status not in "
                                  "'{}'!".format(", ".join(
                                      [STATUS[1] for STATUS in self.STATUSES if
                                       STATUS[0] in self.UNRELATIONAL_STATUS_IDS])))

        super(PerformanceAlert, self).save(*args, **kwargs)

        # check to see if we need to update the summary statuses
        self.summary.update_status()
        if self.related_summary:
            self.related_summary.update_status()

    class Meta:
        db_table = "performance_alert"
        unique_together = ('summary', 'series_signature')

    def __str__(self):
        return "{} {} {}%".format(self.summary, self.series_signature,
                                  self.amount_pct)
