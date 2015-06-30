from django.db import models

from django_ci.models import (ActivableModel, BuildPlatform, DataIngestionManager,
                              Device, FailureClassification, JobType, Machine,
                              MachinePlatform, OptionCollection, Product,
                              Repository, ResultSet)


class Job(ActivableModel):
    job_guid = models.CharField(max_length=50, db_index=True)
    signature = models.CharField(max_length=50, blank=True)
    job_coalesced_to_guid = models.CharField(max_length=50, blank=True,
                                             null=True, db_index=True)
    result_set = models.ForeignKey(ResultSet)
    build_platform = models.ForeignKey(BuildPlatform)
    machine_platform = models.ForeignKey(MachinePlatform)
    machine = models.ForeignKey(Machine, blank=True, null=True)
    device = models.ForeignKey(Device, blank=True, null=True)
    option_collection = models.ForeignKey(OptionCollection,
                                          blank=True, null=True)
    job_type = models.ForeignKey(JobType)
    product = models.ForeignKey(Product, blank=True, null=True)
    failure_classification = models.ForeignKey(FailureClassification)
    who = models.CharField(max_length=50, db_index=True)
    reason = models.CharField(max_length=125, db_index=True)
    result = models.CharField(max_length=25, blank=True, null=True,
                              db_index=True)
    state = models.CharField(max_length=25, db_index=True)
    submit_timestamp = models.IntegerField(db_index=True)
    start_timestamp = models.IntegerField(blank=True, null=True, db_index=True)
    end_timestamp = models.IntegerField(blank=True, null=True, db_index=True)
    last_modified = models.DateTimeField(auto_now=True, db_index=True)
    pending_eta = models.IntegerField(blank=True, null=True, db_index=True)
    running_eta = models.IntegerField(blank=True, null=True, db_index=True)
    tier = models.PositiveSmallIntegerField(default=1, db_index=True)
    repository = models.ForeignKey(Repository)

    objects = DataIngestionManager()
