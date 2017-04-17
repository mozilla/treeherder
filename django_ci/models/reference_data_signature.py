from django.db import models

from django_ci.models import DataIngestionManager


class ReferenceDataSignatures(models.Model):

    """
    A collection of all the possible combinations of reference data,
    populated on data ingestion. signature is a hash of the data it refers to
    build_system_type is buildbot by default
    """
    name = models.CharField(max_length=255L)
    signature = models.CharField(max_length=50L)
    build_os_name = models.CharField(max_length=25L)
    build_platform = models.CharField(max_length=25L)
    build_architecture = models.CharField(max_length=25L)
    machine_os_name = models.CharField(max_length=25L)
    machine_platform = models.CharField(max_length=25L)
    machine_architecture = models.CharField(max_length=25L)
    device_name = models.CharField(max_length=50L)
    job_group_name = models.CharField(max_length=100L, blank=True)
    job_group_symbol = models.CharField(max_length=25L, blank=True)
    job_type_name = models.CharField(max_length=100L)
    job_type_symbol = models.CharField(max_length=25L, blank=True)
    option_collection_hash = models.CharField(max_length=64L, blank=True)
    build_system_type = models.CharField(max_length=25L, blank=True)
    repository = models.CharField(max_length=50L)
    first_submission_timestamp = models.IntegerField()
    review_timestamp = models.IntegerField(null=True, blank=True)
    review_status = models.CharField(max_length=12L, blank=True)

    objects = DataIngestionManager()
