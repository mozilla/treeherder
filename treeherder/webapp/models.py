from __future__ import unicode_literals
from django.db import models


class Product(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'product'

    def __unicode__(self):
        return self.name


class BuildPlatform(models.Model):
    id = models.IntegerField(primary_key=True)
    os_name = models.CharField(max_length=25L)
    platform = models.CharField(max_length=25L)
    architecture = models.CharField(max_length=25L, blank=True)
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'build_platform'

    def __unicode__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


class Option(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'option'

    def __unicode__(self):
        return self.name


class RepositoryGroup(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'repository_group'

    def __unicode__(self):
        return self.name


class Repository(models.Model):
    id = models.IntegerField(primary_key=True)
    repository_group = models.ForeignKey('RepositoryGroup')
    name = models.CharField(max_length=50L)
    type = models.CharField(max_length=25L)
    url = models.CharField(max_length=255L)
    branch = models.CharField(max_length=50L, blank=True)
    project_name = models.CharField(max_length=25L, blank=True)
    description = models.TextField()
    purpose = models.CharField(max_length=50L)
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'repository'

    def __unicode__(self):
        return "{0} {1}".format(
            self.name, self.repository_group)


class MachinePlatform(models.Model):
    id = models.IntegerField(primary_key=True)
    os_name = models.CharField(max_length=25L)
    platform = models.CharField(max_length=25L)
    architecture = models.CharField(max_length=25L, blank=True)
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'machine_platform'

    def __unicode__(self):
        return "{0} {1} {2}".format(
            self.os_name, self.platform, self.architecture)


class Bugscache(models.Model):
    id = models.IntegerField(primary_key=True)
    status = models.CharField(max_length=64L, blank=True)
    resolution = models.CharField(max_length=64L, blank=True)
    summary = models.CharField(max_length=255L)
    crash_signature = models.TextField(blank=True)
    keywords = models.TextField(blank=True)
    os = models.CharField(max_length=64L, blank=True)
    modified = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bugscache'

    def __unicode__(self):
        return "{0}".format(self.id)


class Machine(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    first_timestamp = models.IntegerField()
    last_timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'machine'

    def __unicode__(self):
        return self.name


class MachineNote(models.Model):
    id = models.IntegerField(primary_key=True)
    machine = models.ForeignKey(Machine)
    author = models.CharField(max_length=50L)
    machine_timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True)
    note = models.TextField(blank=True)

    class Meta:
        db_table = 'machine_note'

    def __unicode__(self):
        return "Note {0} on {1} by {2}".format(
            self.id, self.machine, self.author)


class Datasource(models.Model):
    id = models.IntegerField(primary_key=True)
    project = models.CharField(max_length=25L)
    contenttype = models.CharField(max_length=25L)
    dataset = models.IntegerField()
    host = models.CharField(max_length=128L)
    read_only_host = models.CharField(max_length=128L, blank=True)
    name = models.CharField(max_length=128L)
    type = models.CharField(max_length=25L)
    oauth_consumer_key = models.CharField(max_length=45L, blank=True)
    oauth_consumer_secret = models.CharField(max_length=45L, blank=True)
    creation_date = models.DateTimeField()
    cron_batch = models.CharField(max_length=45L, blank=True)

    class Meta:
        db_table = 'datasource'

    def __unicode__(self):
        return "{0} ({1})".format(
            self.name, self.project)


class JobGroup(models.Model):
    id = models.IntegerField(primary_key=True)
    symbol = models.CharField(max_length=10L)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'job_group'

    def __unicode__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


class RepositoryVersion(models.Model):
    id = models.IntegerField(primary_key=True)
    repository = models.ForeignKey(Repository)
    version = models.CharField(max_length=50L)
    timestamp = models.IntegerField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'repository_version'

    def __unicode__(self):
        return "{0} version {1}".format(
            self.repository, self.version)


class OptionCollection(models.Model):
    id = models.IntegerField(primary_key=True)
    option = models.ForeignKey(Option)

    class Meta:
        db_table = 'option_collection'

    def __unicode__(self):
        return "{0}".format(self.option)


class JobType(models.Model):
    id = models.IntegerField(primary_key=True)
    job_group = models.ForeignKey(JobGroup, null=True, blank=True)
    symbol = models.CharField(max_length=10L)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'job_type'

    def __unicode__(self):
        return "{0} ({1})".format(
            self.name, self.symbol)


class FailureClassification(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=50L)
    description = models.TextField()
    active_status = models.CharField(max_length=7L, blank=True)

    class Meta:
        db_table = 'failure_classification'

    def __unicode__(self):
        return self.name
