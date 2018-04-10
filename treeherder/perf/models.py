from __future__ import unicode_literals

import datetime
import time

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MinLengthValidator
from django.db import models
from django.utils.encoding import python_2_unicode_compatible

from treeherder.model.models import (Job,
                                     MachinePlatform,
                                     OptionCollection,
                                     Push,
                                     Repository)

SIGNATURE_HASH_LENGTH = 40


@python_2_unicode_compatible
class PerformanceFramework(models.Model):

    name = models.SlugField(max_length=255, unique=True)
    enabled = models.BooleanField(default=False)

    class Meta:
        db_table = 'performance_framework'

    def __str__(self):
        return self.name


@python_2_unicode_compatible
class PerformanceSignature(models.Model):

    signature_hash = models.CharField(max_length=SIGNATURE_HASH_LENGTH,
                                      validators=[
                                          MinLengthValidator(SIGNATURE_HASH_LENGTH)
                                      ])

    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    framework = models.ForeignKey(PerformanceFramework, on_delete=models.CASCADE)
    platform = models.ForeignKey(MachinePlatform, on_delete=models.CASCADE)
    option_collection = models.ForeignKey(OptionCollection, on_delete=models.CASCADE)
    suite = models.CharField(max_length=80)
    test = models.CharField(max_length=80, blank=True)
    lower_is_better = models.BooleanField(default=True)
    last_updated = models.DateTimeField(db_index=True)
    parent_signature = models.ForeignKey('self', on_delete=models.CASCADE, related_name='subtests',
                                         null=True, blank=True)
    has_subtests = models.BooleanField()

    # extra options to distinguish the test (that don't fit into
    # option collection for whatever reason)
    extra_options = models.CharField(max_length=60, blank=True)

    # these properties override the default settings for how alert
    # generation works
    ALERT_PCT = 0
    ALERT_ABS = 1
    ALERT_CHANGE_TYPES = ((ALERT_PCT, 'percentage'),
                          (ALERT_ABS, 'absolute'))

    should_alert = models.NullBooleanField()
    alert_change_type = models.IntegerField(choices=ALERT_CHANGE_TYPES,
                                            null=True)
    alert_threshold = models.FloatField(null=True)
    min_back_window = models.IntegerField(null=True)
    max_back_window = models.IntegerField(null=True)
    fore_window = models.IntegerField(null=True)

    @staticmethod
    def _get_alert_change_type(alert_change_type_input):
        '''
        Maps a schema-specified alert change type to the internal index
        value
        '''
        for (idx, enum_val) in PerformanceSignature.ALERT_CHANGE_TYPES:
            if enum_val == alert_change_type_input:
                return idx
        return None

    class Meta:
        db_table = 'performance_signature'
        # make sure there is only one signature per repository with a
        # particular set of properties
        unique_together = ('repository', 'framework', 'platform',
                           'option_collection', 'suite', 'test',
                           'last_updated', 'extra_options')
        # make sure there is only one signature of any hash per
        # repository (same hash in different repositories is allowed)
        unique_together = ('repository', 'framework', 'signature_hash')

    def __str__(self):
        name = self.suite
        if self.test:
            name += " {}".format(self.test)
        else:
            name += " summary"

        return "{} {} {} {}".format(self.signature_hash, name, self.platform,
                                    self.last_updated)


class PerformanceDatumManager(models.Manager):
    """
    Convenience functions for operations on groups of performance datums
    """

    def cycle_data(self, repository, cycle_interval, chunk_size, sleep_time):
        """Delete data older than cycle_interval, splitting the target data
into chunks of chunk_size size."""

        max_timestamp = datetime.datetime.now() - cycle_interval

        # seperate datums into chunks
        while True:
            perf_datums_to_cycle = list(self.filter(
                repository=repository,
                push_timestamp__lt=max_timestamp).values_list('id', flat=True)[:chunk_size])
            if not perf_datums_to_cycle:
                # we're done!
                break
            self.filter(id__in=perf_datums_to_cycle).delete()
            if sleep_time:
                # Allow some time for other queries to get through
                time.sleep(sleep_time)

        # also remove any signatures which are (no longer) associated with
        # a job
        for signature in PerformanceSignature.objects.filter(
                repository=repository):
            if not self.filter(signature=signature).exists():
                signature.delete()


@python_2_unicode_compatible
class PerformanceDatum(models.Model):

    objects = PerformanceDatumManager()

    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    signature = models.ForeignKey(PerformanceSignature, on_delete=models.CASCADE)
    value = models.FloatField()
    push_timestamp = models.DateTimeField()

    # job information can expire before the performance datum
    job = models.ForeignKey(Job, null=True, default=None,
                            on_delete=models.SET_NULL)
    push = models.ForeignKey(Push, on_delete=models.CASCADE)

    # the following properties are obsolete and should be removed at some
    # point
    ds_job_id = models.PositiveIntegerField(db_column="ds_job_id", null=True)
    result_set_id = models.PositiveIntegerField(null=True)

    class Meta:
        db_table = 'performance_datum'
        index_together = [
            # this should speed up the typical "get a range of performance datums" query
            ('repository', 'signature', 'push_timestamp'),
            # this should speed up the compare view in treeherder (we only index on
            # repository because we currently filter on it in the query)
            ('repository', 'signature', 'push')]
        unique_together = ('repository', 'job', 'push', 'signature')

    def save(self, *args, **kwargs):
        super(PerformanceDatum, self).save(*args, **kwargs)  # Call the "real" save() method.
        if self.signature.last_updated < self.push_timestamp:
            self.signature.last_updated = self.push_timestamp
            self.signature.save()

    def __str__(self):
        return "{} {}".format(self.value, self.push_timestamp)


@python_2_unicode_compatible
class IssueTracker(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, blank=False)
    task_base_url = models.URLField(max_length=512, null=False)

    class Meta:
        db_table = "issue_tracker"

    def __str__(self):
        return "{} (tasks via {})".format(self.name, self.task_base_url)


@python_2_unicode_compatible
class PerformanceAlertSummary(models.Model):
    '''
    A summarization of performance alerts

    A summary of "alerts" that the performance numbers for a specific
    repository have changed at a particular time.

    See also the :ref:`PerformanceAlert` class below.
    '''
    id = models.AutoField(primary_key=True)
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    framework = models.ForeignKey(PerformanceFramework, on_delete=models.CASCADE)

    prev_push = models.ForeignKey(Push, on_delete=models.CASCADE, related_name='+')
    push = models.ForeignKey(Push, on_delete=models.CASCADE, related_name='+')

    manually_created = models.BooleanField(default=False)

    notes = models.TextField(null=True, blank=True)

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

    issue_tracker = models.ForeignKey(IssueTracker,
                                      on_delete=models.PROTECT,
                                      null=True)

    def update_status(self):
        autodetermined_status = self.autodetermine_status()
        if autodetermined_status != self.status:
            self.status = autodetermined_status
            self.save()

    def autodetermine_status(self):
        alerts = (PerformanceAlert.objects.filter(summary=self) |
                  PerformanceAlert.objects.filter(related_summary=self))

        # if no alerts yet, we'll say untriaged
        if not alerts:
            return PerformanceAlertSummary.UNTRIAGED

        # if any untriaged, then set to untriaged
        if any(alert.status == PerformanceAlert.UNTRIAGED for alert in alerts):
            return PerformanceAlertSummary.UNTRIAGED

        # if all invalid, then set to invalid
        if all(alert.status == PerformanceAlert.INVALID for alert in alerts):
            return PerformanceAlertSummary.INVALID

        # otherwise filter out invalid alerts
        alerts = [a for a in alerts if a.status != PerformanceAlert.INVALID]

        # if there are any "acknowledged" alerts, then set to investigating
        # if not one of the resolved statuses and there are regressions,
        # otherwise we'll say it's an improvement
        if any(alert.status == PerformanceAlert.ACKNOWLEDGED for alert in alerts):
            if all(not alert.is_regression for alert in
                   alerts if alert.status == PerformanceAlert.ACKNOWLEDGED):
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
        if any(alert.status == PerformanceAlert.REASSIGNED for alert in alerts):
            return PerformanceAlertSummary.REASSIGNED

        return PerformanceAlertSummary.DOWNSTREAM

    class Meta:
        db_table = "performance_alert_summary"
        unique_together = ('repository', 'framework', 'prev_push', 'push')

    def __str__(self):
        return "{} {} {}-{}".format(self.framework, self.repository,
                                    self.prev_push.revision,
                                    self.push.revision)


@python_2_unicode_compatible
class PerformanceAlert(models.Model):
    '''
    A single performance alert

    An individual "alert" that the numbers in a specific performance
    series have consistently changed level at a specific time.

    An alert is always a member of an alert summary, which groups all
    the alerts associated with a particular push together. In many cases at
    Mozilla, the original alert summary is not correct, so we allow reassigning
    it to a different (revised) summary.
    '''
    id = models.AutoField(primary_key=True)
    summary = models.ForeignKey(PerformanceAlertSummary,
                                on_delete=models.CASCADE,
                                related_name='alerts')
    related_summary = models.ForeignKey(PerformanceAlertSummary,
                                        on_delete=models.CASCADE,
                                        related_name='related_alerts',
                                        null=True)
    series_signature = models.ForeignKey(PerformanceSignature, on_delete=models.CASCADE)
    is_regression = models.BooleanField()
    classifier = models.ForeignKey(User, on_delete=models.CASCADE, null=True)  # null if autoclassified

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
        "that change is 'real'", null=True)

    manually_created = models.BooleanField(default=False)

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


class PerformanceBugTemplate(models.Model):
    '''
    Template for filing a bug or issue associated with a performance alert
    '''
    framework = models.OneToOneField(PerformanceFramework, on_delete=models.CASCADE)

    keywords = models.CharField(max_length=255)
    status_whiteboard = models.CharField(max_length=255)
    default_component = models.CharField(max_length=255)
    default_product = models.CharField(max_length=255)
    cc_list = models.CharField(max_length=255)

    text = models.TextField(max_length=4096)

    class Meta:
        db_table = "performance_bug_template"

    def __str__(self):
        return '{} bug template'.format(self.framework.name)
