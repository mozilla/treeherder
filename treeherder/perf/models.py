import json
import logging
from datetime import datetime
from functools import reduce

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.validators import MinLengthValidator
from django.db import models
from django.utils.timezone import now as django_now

from treeherder.model.models import (
    Job,
    JobGroup,
    JobType,
    MachinePlatform,
    OptionCollection,
    Push,
    Repository,
)
from treeherder.perf.utils import BUG_DAYS, TRIAGE_DAYS, calculate_time_to
from treeherder.utils import default_serializer

logger = logging.getLogger(__name__)

SIGNATURE_HASH_LENGTH = 40


class PerformanceFramework(models.Model):
    name = models.SlugField(max_length=255, unique=True)
    enabled = models.BooleanField(default=False)

    class Meta:
        db_table = "performance_framework"

    @classmethod
    def fetch_all_names(cls) -> list[str]:
        return cls.objects.values_list("name", flat=True)

    def __str__(self):
        return self.name


class PerformanceSignature(models.Model):
    signature_hash = models.CharField(
        max_length=SIGNATURE_HASH_LENGTH, validators=[MinLengthValidator(SIGNATURE_HASH_LENGTH)]
    )

    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    framework = models.ForeignKey(PerformanceFramework, on_delete=models.CASCADE)
    platform = models.ForeignKey(MachinePlatform, on_delete=models.CASCADE)
    option_collection = models.ForeignKey(OptionCollection, on_delete=models.CASCADE)
    suite = models.CharField(max_length=80)
    test = models.CharField(max_length=80, blank=True)
    application = models.CharField(
        max_length=10,
        default="",
        help_text="Application that runs the signature's tests. "
        "Generally used to record browser's name, but not necessarily.",
    )
    lower_is_better = models.BooleanField(default=True)
    last_updated = models.DateTimeField(db_index=True)
    parent_signature = models.ForeignKey(
        "self", on_delete=models.CASCADE, related_name="subtests", null=True, blank=True
    )
    has_subtests = models.BooleanField()

    # we treat suite & test as human unreadable identifiers
    #  these are their human readable form
    suite_public_name = models.CharField(max_length=30, null=True)
    test_public_name = models.CharField(max_length=30, null=True)

    # free form tags which data producers can specify;
    # enhances semantic labeling & search capabilities,
    # without decoupling perf data
    tags = models.CharField(max_length=360, blank=True)

    # extra options to distinguish the test (that don't fit into
    # option collection for whatever reason)
    # generous max_length permits up to 8 verbose option names
    extra_options = models.CharField(max_length=422, blank=True)

    # TODO: reduce length to minimum value
    # TODO: make this nonnullable, once we demand
    #  all PERFHERDER_DATA dumps to provide the unit field
    measurement_unit = models.CharField(max_length=50, null=True)

    # these properties override the default settings for how alert
    # generation works
    ALERT_PCT = 0
    ALERT_ABS = 1
    ALERT_CHANGE_TYPES = ((ALERT_PCT, "percentage"), (ALERT_ABS, "absolute"))

    should_alert = models.BooleanField(null=True)
    alert_change_type = models.IntegerField(choices=ALERT_CHANGE_TYPES, null=True)
    alert_threshold = models.FloatField(null=True)
    min_back_window = models.IntegerField(null=True)
    max_back_window = models.IntegerField(null=True)
    fore_window = models.IntegerField(null=True)

    @staticmethod
    def _get_alert_change_type(alert_change_type_input):
        """
        Maps a schema-specified alert change type to the internal index
        value
        """
        for idx, enum_val in PerformanceSignature.ALERT_CHANGE_TYPES:
            if enum_val == alert_change_type_input:
                return idx
        return None

    @staticmethod
    def _has_enough_data_points(perf_data):
        if len(perf_data) >= 2:
            start_date = perf_data[0].push_timestamp
            end_date = perf_data[-1].push_timestamp

            perf_data_count = len(perf_data)

            num_months = (end_date.year - start_date.year) * 12 + (
                end_date.month - start_date.month
            )
            if num_months >= 1:
                min_distribution = 2
                average_per_months = perf_data_count / num_months
                if average_per_months >= min_distribution:
                    return True
        return False

    def has_performance_data(self):
        return PerformanceDatum.objects.filter(
            repository_id=self.repository_id,  # leverages (repository, signature) compound index
            signature_id=self.id,
        ).exists()

    def has_data_with_historical_value(self):
        repositories = ["autoland", "mozilla-central"]
        if self.repository.name in repositories:
            perf_data = list(
                PerformanceDatum.objects.filter(
                    repository_id=self.repository_id,  # leverages (repository, signature) compound index
                    signature_id=self.id,
                ).order_by("push_timestamp")
            )
            if self._has_enough_data_points(perf_data):
                return True
        return False

    class Meta:
        db_table = "performance_signature"

        unique_together = (
            # ensure there is only one signature per repository with a
            # particular set of properties
            (
                "repository",
                "suite",
                "test",
                "framework",
                "platform",
                "option_collection",
                "extra_options",
                "last_updated",
                "application",
            ),
            # suite_public_name/test_public_name must be unique
            # and different than suite/test
            (
                "repository",
                "suite_public_name",
                "test_public_name",
                "framework",
                "platform",
                "option_collection",
                "extra_options",
            ),
            # ensure there is only one signature of any hash per
            # repository (same hash in different repositories is allowed)
            ("repository", "framework", "application", "signature_hash"),
        )

    def __str__(self):
        name = self.suite
        if self.test:
            name += f" {self.test}"
        else:
            name += " summary"

        return f"{self.signature_hash} {name} {self.platform} {self.last_updated}"


class PerformanceDatum(models.Model):
    id = models.BigAutoField(primary_key=True)
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    signature = models.ForeignKey(PerformanceSignature, on_delete=models.CASCADE)
    value = models.FloatField()
    push_timestamp = models.DateTimeField(db_index=True)
    application_version = models.CharField(max_length=50, blank=True)

    # job information can expire before the performance datum
    job = models.ForeignKey(Job, null=True, default=None, on_delete=models.SET_NULL)
    push = models.ForeignKey(Push, on_delete=models.CASCADE)

    class Meta:
        db_table = "performance_datum"
        indexes = [
            # Speeds up the typical "get a range of performance datums" query
            models.Index(fields=["repository", "signature", "push_timestamp"]),
            # Speeds up the compare view in treeherder (we only index on
            # repository because we currently filter on it in the query)
            models.Index(fields=["repository", "signature", "push"]),
        ]
        unique_together = ("repository", "job", "push", "push_timestamp", "signature")

    @staticmethod
    def should_mark_as_multi_commit(is_multi_commit: bool, was_created: bool) -> bool:
        return is_multi_commit and was_created

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)  # Call the "real" save() method.
        if self.signature.last_updated < self.push_timestamp:
            self.signature.last_updated = self.push_timestamp
            self.signature.save()

    def __str__(self):
        return f"{self.value} {self.push_timestamp}"


class PerformanceDatumReplicate(models.Model):
    id = models.BigAutoField(primary_key=True)
    performance_datum = models.ForeignKey(PerformanceDatum, on_delete=models.CASCADE)
    value = models.FloatField()

    class Meta:
        db_table = "performance_datum_replicate"


class MultiCommitDatum(models.Model):
    perf_datum = models.OneToOneField(
        PerformanceDatum,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="multi_commit_datum",
    )


class IssueTracker(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, blank=False)
    task_base_url = models.URLField(max_length=512, null=False)

    class Meta:
        db_table = "issue_tracker"

    def __str__(self):
        return f"{self.name} (tasks via {self.task_base_url})"


class PerformanceAlertSummaryBase(models.Model):
    """
    A summarization of performance alerts

    A summary of "alerts" that the performance numbers for a specific
    repository have changed at a particular time.

    See also the :ref:`PerformanceAlert` class below.
    """

    id = models.AutoField(primary_key=True)
    repository = models.ForeignKey(Repository, on_delete=models.CASCADE)
    framework = models.ForeignKey(PerformanceFramework, on_delete=models.CASCADE)

    prev_push = models.ForeignKey(Push, on_delete=models.CASCADE, related_name="+")
    push = models.ForeignKey(Push, on_delete=models.CASCADE, related_name="+")
    original_push = models.ForeignKey(
        Push, on_delete=models.CASCADE, related_name="+", null=True, default=None
    )
    manually_created = models.BooleanField(default=False)

    notes = models.TextField(null=True, blank=True)
    assignee = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="assigned_alerts"
    )

    created = models.DateTimeField(auto_now_add=True, db_index=True)
    triage_due_date = models.DateTimeField(null=True, default=None)
    first_triaged = models.DateTimeField(null=True, default=None)
    last_updated = models.DateTimeField(auto_now=True, null=True)

    UNTRIAGED = 0
    DOWNSTREAM = 1
    REASSIGNED = 2
    INVALID = 3
    IMPROVEMENT = 4
    INVESTIGATING = 5
    WONTFIX = 6
    FIXED = 7
    BACKED_OUT = 8

    STATUSES = (
        (UNTRIAGED, "Untriaged"),
        (DOWNSTREAM, "Downstream"),
        (REASSIGNED, "Reassigned"),
        (INVALID, "Invalid"),
        (IMPROVEMENT, "Improvement"),
        (INVESTIGATING, "Investigating"),
        (WONTFIX, "Won't fix"),
        (FIXED, "Fixed"),
        (BACKED_OUT, "Backed out"),
    )

    status = models.IntegerField(choices=STATUSES, default=UNTRIAGED)

    bug_number = models.PositiveIntegerField(null=True)
    bug_due_date = models.DateTimeField(null=True, default=None)
    bug_updated = models.DateTimeField(null=True)

    issue_tracker = models.ForeignKey(IssueTracker, on_delete=models.PROTECT, default=1)  # Bugzilla

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        # allows updating timestamps only on new values
        self.__prev_bug_number = self.bug_number

    def save(self, *args, update_fields=None, **kwargs):
        if self.bug_number is not None and self.bug_number != self.__prev_bug_number:
            self.bug_updated = datetime.now()

            if update_fields is not None:
                update_fields = {"bug_updated"}.union(update_fields)

        triage_due = calculate_time_to(self.created, TRIAGE_DAYS)
        # created is initially PerformanceDatum.push_timestamp and due to a potential race condition
        # triage_due_date is not always calculated after the real created date
        if self.triage_due_date != triage_due:
            self.triage_due_date = triage_due

            if update_fields is not None:
                update_fields = {"triage_due_date"}.union(update_fields)

        bug_due = calculate_time_to(self.created, BUG_DAYS)
        if self.bug_due_date != bug_due:
            self.bug_due_date = bug_due

            if update_fields is not None:
                update_fields = {"bug_due_date"}.union(update_fields)

        if not self.original_push:
            self.original_push = self.push

        super().save(*args, update_fields=update_fields, **kwargs)
        self.__prev_bug_number = self.bug_number

    def update_status(self, using=None):
        self.status = self.autodetermine_status()
        self.save(using=using)

    def autodetermine_status(self, alert_model=None):
        summary_class = self.__class__
        if not alert_model:
            alert_model = PerformanceAlert

        alerts = alert_model.objects.filter(summary=self) | alert_model.objects.filter(
            related_summary=self
        )

        # if no alerts yet, we'll say untriaged
        if not alerts:
            return summary_class.UNTRIAGED

        # if any untriaged, then set to untriaged
        if any(alert.status == alert_model.UNTRIAGED for alert in alerts):
            return summary_class.UNTRIAGED

        # if the summary's status is IMPROVEMENT, but a regression is
        # reassigned to that summary then set the summary's status to untriaged
        # and change all acknowledged statuses to untriaged
        if self.status == summary_class.IMPROVEMENT:
            if any(
                alert.status == alert_model.REASSIGNED and alert.is_regression for alert in alerts
            ):
                acknowledged_alerts = [
                    alert for alert in alerts if alert.status == alert_model.ACKNOWLEDGED
                ]
                for alert in acknowledged_alerts:
                    alert.status = alert_model.UNTRIAGED
                    alert.save()
                return summary_class.UNTRIAGED

        # if all invalid, then set to invalid
        if all(alert.status == alert_model.INVALID for alert in alerts):
            return summary_class.INVALID

        # otherwise filter out invalid alerts
        alerts = [a for a in alerts if a.status != alert_model.INVALID]

        # if there are any "acknowledged" alerts, then set to investigating
        # if not one of the resolved statuses and there are regressions,
        # otherwise we'll say it's an improvement
        if any(alert.status == alert_model.ACKNOWLEDGED for alert in alerts):
            if all(
                not alert.is_regression
                for alert in alerts
                if alert.status == alert_model.ACKNOWLEDGED
                or (alert.status == alert_model.REASSIGNED and alert.related_summary.id == self.id)
            ):
                return summary_class.IMPROVEMENT
            elif self.status not in (
                summary_class.IMPROVEMENT,
                summary_class.INVESTIGATING,
                summary_class.WONTFIX,
                summary_class.FIXED,
                summary_class.BACKED_OUT,
            ):
                return summary_class.INVESTIGATING
            # keep status if one of the investigating ones
            return self.status

        # at this point, we've determined that this is a summary with no valid
        # alerts of its own: all alerts should be either reassigned,
        # downstream, or invalid (but not all invalid, that case is covered
        # above)
        if any(alert.status == alert_model.REASSIGNED for alert in alerts):
            return summary_class.REASSIGNED

        return summary_class.DOWNSTREAM

    def timestamp_first_triage(self):
        # called for summary specific updates (e.g. notes, bug linking)
        if self.first_triaged is None:
            self.first_triaged = django_now()
        return self

    class Meta:
        abstract = True

    def __str__(self):
        return f"{self.framework} {self.repository} {self.prev_push.revision}-{self.push.revision}"


class PerformanceAlertSummary(PerformanceAlertSummaryBase):
    class Meta:
        db_table = "performance_alert_summary"
        unique_together = ("repository", "framework", "prev_push", "push")


class PerformanceAlertSummaryTesting(PerformanceAlertSummaryBase):
    assignee = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name="assigned_alerts_testing"
    )

    def autodetermine_status(self, alert_model=None):
        super().autodetermine_status(alert_model=PerformanceAlertTesting)

    class Meta:
        db_table = "performance_alert_summary_testing"
        unique_together = ("repository", "framework", "prev_push", "push")


class PerformanceAlertBase(models.Model):
    """
    A single performance alert

    An individual "alert" that the numbers in a specific performance
    series have consistently changed level at a specific time.

    An alert is always a member of an alert summary, which groups all
    the alerts associated with a particular push together. In many cases at
    Mozilla, the original alert summary is not correct, so we allow reassigning
    it to a different (revised) summary.
    """

    id = models.AutoField(primary_key=True)
    summary = models.ForeignKey(
        PerformanceAlertSummary, on_delete=models.CASCADE, related_name="alerts"
    )
    related_summary = models.ForeignKey(
        PerformanceAlertSummary, on_delete=models.CASCADE, related_name="related_alerts", null=True
    )
    series_signature = models.ForeignKey(PerformanceSignature, on_delete=models.CASCADE)
    is_regression = models.BooleanField()
    starred = models.BooleanField(default=False)
    classifier = models.ForeignKey(
        User, on_delete=models.CASCADE, null=True
    )  # null if autoclassified

    created = models.DateTimeField(auto_now_add=True, null=True)
    # time when human user 1st interacted with alert
    # IMPORTANT: workers & automated scripts mustn't update this! Dont' assign this outside setter method!
    first_triaged = models.DateTimeField(null=True, default=None)
    last_updated = models.DateTimeField(auto_now=True, null=True)

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

    STATUSES = (
        (UNTRIAGED, "Untriaged"),
        (DOWNSTREAM, "Downstream"),
        (REASSIGNED, "Reassigned"),
        (INVALID, "Invalid"),
        (ACKNOWLEDGED, "Acknowledged"),
    )

    status = models.IntegerField(choices=STATUSES, default=UNTRIAGED)

    amount_pct = models.FloatField(help_text="Amount in percentage that series has changed")
    amount_abs = models.FloatField(help_text="Absolute amount that series has changed")
    prev_value = models.FloatField(help_text="Previous value of series before change")
    new_value = models.FloatField(help_text="New value of series after change")
    t_value = models.FloatField(
        help_text="t value out of analysis indicating confidence that change is 'real'",
        null=True,
    )

    confidence = models.FloatField(
        help_text=(
            "A value that indicates the confidence of the alert (specific to "
            "the detection method used)"
        ),
        null=True,
    )
    detection_method = models.CharField(max_length=100, null=True)

    SKEWED = "SKEWED"
    OUTLIERS = "OUTLIERS"
    MODAL = "MODAL"
    OK = "OK"
    NA = "N/A"

    NOISE_PROFILES = (
        (SKEWED, "Samples are heavily found on one side of the mean."),
        (OUTLIERS, "There are more outliers than should be expected from a normal distribution."),
        (MODAL, "There are multiple areas where most values are found rather than only one."),
        (OK, "No issues were found."),
        (NA, "Could not compute a noise profile."),
    )

    noise_profile = models.CharField(
        max_length=30,
        choices=NOISE_PROFILES,
        default="N/A",
        help_text="The noise profile of the data which precedes this alert.",
    )

    manually_created = models.BooleanField(default=False)

    @property
    def initial_culprit_job(self) -> Job | None:
        if hasattr(self, "__initial_culprit_job"):
            return self.__initial_culprit_job

        try:
            # the original culprit data point, it may not be the real culprit's one
            # because we search by the summary's push which may not be exact
            culprit_data_point = PerformanceDatum.objects.filter(
                repository=self.series_signature.repository,
                signature=self.series_signature,
                push=self.summary.push,
            ).order_by("id")[0]
            self.__initial_culprit_job = culprit_data_point.job
        except IndexError:
            logger.debug(f"Could not find the initial culprit job for alert {self.id}.")
            self.__initial_culprit_job = None

        return self.__initial_culprit_job

    def save(self, *args, **kwargs):
        # validate that we set a status that makes sense for presence
        # or absence of a related summary
        if self.related_summary and self.status not in self.RELATIONAL_STATUS_IDS:
            raise ValidationError(
                "Related summary set but status not in '{}'!".format(
                    ", ".join(
                        [
                            STATUS[1]
                            for STATUS in self.STATUSES
                            if STATUS[0] in self.RELATIONAL_STATUS_IDS
                        ]
                    )
                )
            )
        if not self.related_summary and self.status not in self.UNRELATIONAL_STATUS_IDS:
            raise ValidationError(
                "Related summary not set but status not in '{}'!".format(
                    ", ".join(
                        [
                            STATUS[1]
                            for STATUS in self.STATUSES
                            if STATUS[0] in self.UNRELATIONAL_STATUS_IDS
                        ]
                    )
                )
            )

        super().save(*args, **kwargs)

        # check to see if we need to update the summary statuses

        # just forward the explicit database
        # so the summary properly updates there
        using = kwargs.get("using", None)
        self.summary.update_status(using=using)
        if self.related_summary:
            self.related_summary.update_status(using=using)

    def timestamp_first_triage(self):
        # use only on code triggered by
        # human interaction
        if self.first_triaged is None:
            self.first_triaged = django_now()
            self.summary.timestamp_first_triage().save()
        return self

    class Meta:
        abstract = True

    def __str__(self):
        return f"{self.summary} {self.series_signature} {self.amount_pct}%"


class PerformanceAlert(PerformanceAlertBase):
    class Meta:
        db_table = "performance_alert"
        unique_together = ("summary", "series_signature")


class PerformanceAlertTesting(PerformanceAlertBase):
    summary = models.ForeignKey(
        PerformanceAlertSummaryTesting, on_delete=models.CASCADE, related_name="alerts"
    )
    related_summary = models.ForeignKey(
        PerformanceAlertSummaryTesting,
        on_delete=models.CASCADE,
        related_name="related_alerts",
        null=True,
    )

    class Meta:
        db_table = "performance_alert_testing"
        unique_together = ("summary", "series_signature")


class PerformanceTag(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=30, unique=True)
    alert_summaries = models.ManyToManyField(
        PerformanceAlertSummary, related_name="performance_tags"
    )

    class Meta:
        db_table = "performance_tag"


class PerformanceBugTemplate(models.Model):
    """
    Template for filing a bug or issue associated with a performance alert
    """

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
        return f"{self.framework.name} bug template"


# TODO: we actually need this name for the Sherlock' s hourly report
class BackfillReport(models.Model):
    """
    Groups & stores all context required to retrigger/backfill
    relevant alerts from a performance alert summary.
    """

    summary = models.OneToOneField(
        PerformanceAlertSummary,
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="backfill_report",
    )

    created = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)
    frozen = models.BooleanField(default=False)

    @property
    def is_outdated(self):
        # alert summary updated since last report was made
        return self.summary.last_updated > self.last_updated

    def expel_records(self):
        BackfillRecord.objects.filter(report=self).delete()
        self.save()  # refresh last_updated

    class Meta:
        db_table = "backfill_report"

    def __str__(self):
        return f"BackfillReport(summary #{self.summary.id}, last update {self.last_updated})"


class BackfillRecord(models.Model):
    alert = models.OneToOneField(
        PerformanceAlert, on_delete=models.CASCADE, primary_key=True, related_name="backfill_record"
    )

    report = models.ForeignKey(BackfillReport, on_delete=models.CASCADE, related_name="records")

    # all data required to retrigger/backfill
    # associated perf alert, as JSON dump
    # TODO: could we employ a JSONField?
    context = models.TextField()
    created = models.DateTimeField(auto_now_add=True)

    PRELIMINARY = 0
    READY_FOR_PROCESSING = 1
    BACKFILLED = 2
    SUCCESSFUL = 3
    FAILED = 4

    STATUSES = (
        (PRELIMINARY, "Preliminary"),
        (READY_FOR_PROCESSING, "Ready for processing"),
        (BACKFILLED, "Backfilled"),
        (SUCCESSFUL, "Successful"),
        (FAILED, "Failed"),
    )

    status = models.IntegerField(choices=STATUSES, default=PRELIMINARY)

    # Backfill outcome
    log_details = models.TextField()  # JSON expected, not supported by Django
    job_type = models.ForeignKey(
        JobType, null=True, on_delete=models.SET_NULL, related_name="backfill_records"
    )
    job_group = models.ForeignKey(
        JobGroup, null=True, on_delete=models.SET_NULL, related_name="backfill_records"
    )
    job_tier = models.PositiveIntegerField(null=True)
    job_platform_option = models.CharField(max_length=100, null=True)

    total_actions_triggered = models.IntegerField(default=0)
    total_backfills_failed = models.IntegerField(default=0)
    total_backfills_successful = models.IntegerField(default=0)
    total_backfills_in_progress = models.IntegerField(default=0)

    @property
    def id(self):
        return self.alert

    @property
    def repository(self) -> Repository:
        return self.alert.summary.repository

    @property
    def platform(self) -> MachinePlatform:
        return self.alert.series_signature.platform

    @property
    def job_symbol(self) -> str | None:
        if not all([self.job_tier, self.job_group, self.job_type]):
            return None

        tier_label = ""
        if self.job_tier > 1:
            tier_label = f"[tier {self.job_tier}]"

        group_symbol = self.job_group.symbol
        type_symbol = self.job_type.symbol

        return f"{group_symbol}{tier_label}({type_symbol})"

    def try_remembering_job_properties(self, job_id: str):
        if all([self.job_type, self.job_group, self.job_tier, self.job_platform_option]):
            # classification was already set
            return

        try:
            job = Job.objects.get(id=job_id)
            self.__remember_job_properties(job)
        except Job.DoesNotExist as ex:
            logger.warning(ex)
            logger.debug(
                f"Failed to set properties of job ID {job_id} to record ID {self.alert_id}."
            )

    def __remember_job_properties(self, job: Job):
        if self.job_type is None:
            self.job_type = job.job_type
        if self.job_group is None:
            self.job_group = job.job_group
        if self.job_tier is None:
            self.job_tier = job.tier
        if self.job_platform_option is None:
            self.job_platform_option = job.get_platform_option()
        self.save()

    def get_context_border_info(self, context_property: str) -> tuple[str, str]:
        """
        Provides border(first and last) information from context based on the property
        """
        context = self.get_context()
        from_info = context[0][context_property]
        to_info = context[-1][context_property]

        return from_info, to_info

    def get_pushes_in_context_range(self) -> list[Push]:
        from_time, to_time = self.get_context_border_info("push_timestamp")

        return Push.objects.filter(
            repository=self.repository, time__gte=from_time, time__lte=to_time
        ).all()

    def get_job_search_str(self) -> str:
        platform = deepgetattr(self, "platform.platform")
        platform_option = deepgetattr(self, "job_platform_option")
        job_group_name = deepgetattr(self, "job_group.name")
        job_type_name = deepgetattr(self, "job_type.name")
        job_type_symbol = deepgetattr(self, "job_type.symbol")

        search_terms = [platform, platform_option, job_group_name, job_type_name, job_type_symbol]
        search_terms = list(filter(None, search_terms))

        return ",".join(search_terms)

    def get_context(self) -> list[dict]:
        return json.loads(self.context)

    def set_context(self, value: list[dict]):
        self.context = json.dumps(value, default=str)

    def set_log_details(self, value: dict):
        self.log_details = json.dumps(value, default=str)

    def save(self, *args, **kwargs):
        # refresh parent's latest update time
        super().save(*args, **kwargs)
        self.report.save(using=kwargs.get("using"))

    def delete(self, using=None, keep_parents=False):
        super().delete(using, keep_parents)
        self.report.save()  # refresh last_updated

    class Meta:
        db_table = "backfill_record"

    def __str__(self):
        return f"BackfillRecord(alert #{self.alert.id}, from {self.report})"


class BackfillNotificationRecord(models.Model):
    """
    Groups & stores all backfilled records so that
    they can be sent all in one email summary, once a day.
    """

    record = models.OneToOneField(
        BackfillRecord,
        on_delete=models.CASCADE,
        related_name="backfill_notification_record",
    )
    created = models.DateTimeField(auto_now_add=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "backfill_notification_record"

    def __str__(self):
        return "Backfill Notification Record"


class PerformanceSettings(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    settings = models.TextField()

    def set_settings(self, value: str):
        self.settings = json.dumps(value, default=default_serializer)

    class Meta:
        db_table = "performance_settings"


def deepgetattr(obj: object, attr_chain: str) -> object | None:
    """Recursively follow an attribute chain to get the final value.

    @param attr_chain: e.g. 'repository.name', 'job_type', 'record.platform.architecture' etc
    @return: None if any attribute within chain does not exist.
    """
    try:
        return reduce(getattr, attr_chain.split("."), obj)
    except AttributeError:
        logger.debug(
            f"Failed to access deeply nested attribute `{attr_chain}` on object of type {type(obj)}."
        )
        return None
