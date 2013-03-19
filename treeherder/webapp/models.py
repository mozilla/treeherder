from __future__ import unicode_literals
from django.db import models
import uuid
import subprocess
from treeherder import path


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
    creation_date = models.DateTimeField(auto_now_add=True)
    cron_batch = models.CharField(max_length=45L, blank=True)

    class Meta:
        db_table = 'datasource'
        unique_together = [
            ["project", "dataset", "contenttype"],
            ["host", "name"],
        ]

    def __unicode__(self):
        return "{0} ({1})".format(
            self.name, self.project)

    def save(self, *args, **kwargs):
        inserting = not self.pk
        if inserting:
            if not self.name:
                self.name = "{0}_{1}_{2}".format(
                    self.project,
                    self.contenttype,
                    self.dataset
                )
            if not self.type:
                self.type = "mysql"

            self.oauth_consumer_key = None
            self.oauth_consumer_secret = None

            if self.contenttype == 'objectstore':
                self.oauth_consumer_key = uuid.uuid4()
                self.oauth_consumer_secret = uuid.uuid4()

        super(Datasource, self).save(*args, **kwargs)
        if inserting:
            self.create_db()

    def create_db(self, schema_file=None):
        """
        Create the database for this source, using given SQL schema file.

        If schema file is not given, defaults to
        "template_schema/schema_<contenttype>.sql.tmpl".

        Assumes that the database server at ``self.host`` is accessible, and
        that ``DATABASE_USER`` (identified by
        ``DATABASE_PASSWORD`` exists on it and has permissions to
        create databases.
        """
        from django.conf import settings
        import MySQLdb
        DB_USER = settings.DATABASES["default"]["USER"]
        DB_PASS = settings.DATABASES["default"]["PASSWORD"]
        if self.type.lower().startswith("mysql-"):
            engine = self.type[len("mysql-"):]
        elif self.type.lower() == "mysql":
            engine = "InnoDB"
        else:
            raise NotImplementedError(
                "Currently only MySQL data source is supported.")

        if schema_file is None:
            schema_file = path(
                "model",
                "sql",
                "template_schema",
                "project_{0}_1.sql.tmpl".format(self.contenttype),
            )

        conn = MySQLdb.connect(
            host=self.host,
            user=DB_USER,
            passwd=DB_PASS,
        )
        cur = conn.cursor()
        cur.execute("CREATE DATABASE {0}".format(self.name))
        conn.close()

        # MySQLdb provides no way to execute an entire SQL file in bulk, so we
        # have to shell out to the commandline client.
        with open(schema_file) as f:
            # set the engine to use
            sql = f.read().format(engine=engine)

        args = [
            "mysql",
            "--host={0}".format(self.host),
            "--user={0}".format(DB_USER),
        ]
        if DB_PASS:
            args.append(
                "--password={0}".format(
                    DB_PASS)
            )
        args.append(self.name)
        proc = subprocess.Popen(
            args,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        (output, _) = proc.communicate(sql)
        if proc.returncode:
            raise IOError(
                "Unable to set up schema for datasource {0}: "
                "mysql returned code {1}, output follows:\n\n{2}".format(
                    self.key, proc.returncode, output
                )
            )

    def delete_db(self):
        from django.conf import settings
        import MySQLdb
        DB_USER = settings.DATABASES["default"]["USER"]
        DB_PASS = settings.DATABASES["default"]["PASSWORD"]
        conn = MySQLdb.connect(
            host=self.host,
            user=DB_USER,
            passwd=DB_PASS,
        )
        cur = conn.cursor()
        cur.execute("DROP DATABASE {0}".format(self.name))
        conn.close()

    def delete(self, *args, **kwargs):
        self.delete_db()
        super(Datasource, self).delete(*args, **kwargs)

    def truncate(self, skip_list=None):
        """
        Truncate all tables in the db self refers to.
        Skip_list is a list of table names to skip truncation.
        """
        from django.conf import settings
        import MySQLdb

        skip_list = set(skip_list or [])

        DB_USER = settings.DATABASES["default"]["USER"]
        DB_PASS = settings.DATABASES["default"]["PASSWORD"]

        conn = MySQLdb.connect(
            host=self.host,
            user=DB_USER,
            passwd=DB_PASS,
            db=self.name,
        )
        cur = conn.cursor()
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        cur.execute("SHOW TABLES")

        for table, in cur.fetchall():
            # if there is a skip_list, then skip any table with matching name
            if table.lower() not in skip_list:
                # needed to use backticks around table name, because if the
                # table name is a keyword (like "option") then this will fail
                cur.execute("TRUNCATE TABLE `{0}`".format(table))

        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.close()


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
        unique_together = ['id', 'option']

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
