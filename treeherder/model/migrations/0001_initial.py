# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from django.db import models, migrations
import jsonfield.fields
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Bugscache',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('status', models.CharField(db_index=True, max_length=64, blank=True)),
                ('resolution', models.CharField(db_index=True, max_length=64, blank=True)),
                ('summary', models.CharField(max_length=255)),
                ('crash_signature', models.TextField(blank=True)),
                ('keywords', models.TextField(blank=True)),
                ('os', models.CharField(max_length=64, blank=True)),
                ('modified', models.DateTimeField(null=True, blank=True)),
            ],
            options={
                'db_table': 'bugscache',
            },
        ),
        migrations.CreateModel(
            name='BuildPlatform',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('os_name', models.CharField(max_length=25, db_index=True)),
                ('platform', models.CharField(max_length=25, db_index=True)),
                ('architecture', models.CharField(db_index=True, max_length=25, blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'build_platform',
            },
        ),
        migrations.CreateModel(
            name='ClassifiedFailure',
            fields=[
                ('id', models.BigAutoField(serialize=False, primary_key=True)),
                ('bug_number', models.PositiveIntegerField(null=True, blank=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('modified', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'classified_failure',
            },
        ),
        migrations.CreateModel(
            name='Datasource',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('project', models.CharField(unique=True, max_length=50)),
                ('name', models.CharField(unique=True, max_length=128)),
                ('oauth_consumer_key', models.CharField(max_length=45, null=True, blank=True)),
                ('oauth_consumer_secret', models.CharField(max_length=45, null=True, blank=True)),
            ],
            options={
                'db_table': 'datasource',
            },
        ),
        migrations.CreateModel(
            name='ExclusionProfile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(unique=True, max_length=255)),
                ('is_default', models.BooleanField(default=False, db_index=True)),
                ('flat_exclusion', jsonfield.fields.JSONField(default={}, blank=True)),
                ('modified', models.DateTimeField(auto_now=True)),
                ('author', models.ForeignKey(related_name='exclusion_profiles_authored', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'exclusion_profile',
            },
        ),
        migrations.CreateModel(
            name='FailureClassification',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'failure_classification',
            },
        ),
        migrations.CreateModel(
            name='FailureLine',
            fields=[
                ('id', models.BigAutoField(serialize=False, primary_key=True)),
                ('job_guid', models.CharField(max_length=50)),
                ('action', models.CharField(max_length=11, choices=[('test_result', 'test_result'), ('log', 'log'), ('crash', 'crash'), ('truncated', 'truncated')])),
                ('line', models.PositiveIntegerField()),
                ('test', models.TextField(null=True, blank=True)),
                ('subtest', models.TextField(null=True, blank=True)),
                ('status', models.CharField(max_length=7, choices=[('PASS', 'PASS'), ('FAIL', 'FAIL'), ('OK', 'OK'), ('ERROR', 'ERROR'), ('TIMEOUT', 'TIMEOUT'), ('CRASH', 'CRASH'), ('ASSERT', 'ASSERT'), ('SKIP', 'SKIP'), ('NOTRUN', 'NOTRUN')])),
                ('expected', models.CharField(blank=True, max_length=7, null=True, choices=[('PASS', 'PASS'), ('FAIL', 'FAIL'), ('OK', 'OK'), ('ERROR', 'ERROR'), ('TIMEOUT', 'TIMEOUT'), ('CRASH', 'CRASH'), ('ASSERT', 'ASSERT'), ('SKIP', 'SKIP'), ('NOTRUN', 'NOTRUN')])),
                ('message', models.TextField(null=True, blank=True)),
                ('signature', models.TextField(null=True, blank=True)),
                ('level', models.CharField(blank=True, max_length=8, null=True, choices=[('PASS', 'PASS'), ('FAIL', 'FAIL'), ('OK', 'OK'), ('ERROR', 'ERROR'), ('TIMEOUT', 'TIMEOUT'), ('CRASH', 'CRASH'), ('ASSERT', 'ASSERT'), ('SKIP', 'SKIP'), ('NOTRUN', 'NOTRUN')])),
                ('stack', models.TextField(null=True, blank=True)),
                ('stackwalk_stdout', models.TextField(null=True, blank=True)),
                ('stackwalk_stderr', models.TextField(null=True, blank=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('modified', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'failure_line',
            },
        ),
        migrations.CreateModel(
            name='FailureMatch',
            fields=[
                ('id', models.BigAutoField(serialize=False, primary_key=True)),
                ('score', models.DecimalField(null=True, max_digits=3, decimal_places=2, blank=True)),
                ('is_best', models.BooleanField(default=False)),
                ('classified_failure', models.ForeignKey(to='model.ClassifiedFailure')),
                ('failure_line', models.ForeignKey(to='model.FailureLine')),
            ],
            options={
                'db_table': 'failure_match',
            },
        ),
        migrations.CreateModel(
            name='JobExclusion',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(unique=True, max_length=255)),
                ('description', models.TextField(blank=True)),
                ('info', jsonfield.fields.JSONField()),
                ('author', models.ForeignKey(to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'job_exclusion',
            },
        ),
        migrations.CreateModel(
            name='JobGroup',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('symbol', models.CharField(default='?', max_length=10, db_index=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'job_group',
            },
        ),
        migrations.CreateModel(
            name='JobType',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('symbol', models.CharField(default='?', max_length=10, db_index=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
                ('job_group', models.ForeignKey(blank=True, to='model.JobGroup', null=True)),
            ],
            options={
                'db_table': 'job_type',
            },
        ),
        migrations.CreateModel(
            name='Machine',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('first_timestamp', models.IntegerField(db_index=True)),
                ('last_timestamp', models.IntegerField(db_index=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'machine',
            },
        ),
        migrations.CreateModel(
            name='MachinePlatform',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('os_name', models.CharField(max_length=25, db_index=True)),
                ('platform', models.CharField(max_length=25, db_index=True)),
                ('architecture', models.CharField(db_index=True, max_length=25, blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'machine_platform',
            },
        ),
        migrations.CreateModel(
            name='Matcher',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(unique=True, max_length=50)),
            ],
            options={
                'db_table': 'matcher',
            },
        ),
        migrations.CreateModel(
            name='Option',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'option',
            },
        ),
        migrations.CreateModel(
            name='OptionCollection',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('option_collection_hash', models.CharField(max_length=40, db_index=True)),
                ('option', models.ForeignKey(to='model.Option')),
            ],
            options={
                'db_table': 'option_collection',
            },
        ),
        migrations.CreateModel(
            name='Product',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'product',
            },
        ),
        migrations.CreateModel(
            name='ReferenceDataSignatures',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=255)),
                ('signature', models.CharField(max_length=50, db_index=True)),
                ('build_os_name', models.CharField(max_length=25, db_index=True)),
                ('build_platform', models.CharField(max_length=25, db_index=True)),
                ('build_architecture', models.CharField(max_length=25, db_index=True)),
                ('machine_os_name', models.CharField(max_length=25, db_index=True)),
                ('machine_platform', models.CharField(max_length=25, db_index=True)),
                ('machine_architecture', models.CharField(max_length=25, db_index=True)),
                ('job_group_name', models.CharField(db_index=True, max_length=100, blank=True)),
                ('job_group_symbol', models.CharField(db_index=True, max_length=25, blank=True)),
                ('job_type_name', models.CharField(max_length=100, db_index=True)),
                ('job_type_symbol', models.CharField(db_index=True, max_length=25, blank=True)),
                ('option_collection_hash', models.CharField(db_index=True, max_length=64, blank=True)),
                ('build_system_type', models.CharField(db_index=True, max_length=25, blank=True)),
                ('repository', models.CharField(max_length=50, db_index=True)),
                ('first_submission_timestamp', models.IntegerField(db_index=True)),
                ('review_timestamp', models.IntegerField(db_index=True, null=True, blank=True)),
                ('review_status', models.CharField(db_index=True, max_length=12, blank=True)),
            ],
            options={
                'db_table': 'reference_data_signatures',
            },
        ),
        migrations.CreateModel(
            name='Repository',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('dvcs_type', models.CharField(max_length=25, db_index=True)),
                ('url', models.CharField(max_length=255)),
                ('codebase', models.CharField(db_index=True, max_length=50, blank=True)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'repository',
            },
        ),
        migrations.CreateModel(
            name='RepositoryGroup',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7, db_index=True, blank=True)),
            ],
            options={
                'db_table': 'repository_group',
            },
        ),
        migrations.CreateModel(
            name='UserExclusionProfile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('is_default', models.BooleanField(default=True, db_index=True)),
                ('exclusion_profile', models.ForeignKey(blank=True, to='model.ExclusionProfile', null=True)),
                ('user', models.ForeignKey(related_name='exclusion_profiles', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_exclusion_profile',
            },
        ),
        migrations.AddField(
            model_name='repository',
            name='repository_group',
            field=models.ForeignKey(to='model.RepositoryGroup'),
        ),
        migrations.AlterUniqueTogether(
            name='referencedatasignatures',
            unique_together=set([('name', 'signature', 'build_system_type', 'repository')]),
        ),
        migrations.AlterUniqueTogether(
            name='jobgroup',
            unique_together=set([('name', 'symbol')]),
        ),
        migrations.AddField(
            model_name='failurematch',
            name='matcher',
            field=models.ForeignKey(to='model.Matcher'),
        ),
        migrations.AddField(
            model_name='failureline',
            name='repository',
            field=models.ForeignKey(to='model.Repository'),
        ),
        migrations.AddField(
            model_name='exclusionprofile',
            name='exclusions',
            field=models.ManyToManyField(related_name='profiles', to='model.JobExclusion'),
        ),
        migrations.AddField(
            model_name='classifiedfailure',
            name='failure_lines',
            field=models.ManyToManyField(related_name='intermittent_failures', through='model.FailureMatch', to='model.FailureLine'),
        ),
        migrations.AlterUniqueTogether(
            name='userexclusionprofile',
            unique_together=set([('user', 'exclusion_profile')]),
        ),
        migrations.AlterUniqueTogether(
            name='optioncollection',
            unique_together=set([('option_collection_hash', 'option')]),
        ),
        migrations.AlterUniqueTogether(
            name='jobtype',
            unique_together=set([('name', 'symbol')]),
        ),
        migrations.AlterUniqueTogether(
            name='failurematch',
            unique_together=set([('failure_line', 'classified_failure', 'matcher')]),
        ),
        migrations.AlterUniqueTogether(
            name='failureline',
            unique_together=set([('job_guid', 'line')]),
        ),
        migrations.RunSQL(
            sql='CREATE FULLTEXT INDEX `idx_summary` on bugscache (`summary`);',
            reverse_sql='ALTER TABLE bugscache DROP INDEX idx_summary',
        ),
        migrations.RunSQL(
            sql='CREATE FULLTEXT INDEX `idx_crash_signature` on bugscache (`crash_signature`);',
            reverse_sql='ALTER TABLE bugscache DROP INDEX idx_crash_signature',
        ),
        migrations.RunSQL(
            sql='CREATE FULLTEXT INDEX `idx_keywords` on bugscache (`keywords`);',
            reverse_sql='ALTER TABLE bugscache DROP INDEX idx_keywords',
        ),
        migrations.RunSQL(
            sql='CREATE FULLTEXT INDEX `idx_all_full_text` on bugscache (`summary`, `crash_signature`, `keywords`);',
            reverse_sql='ALTER TABLE bugscache DROP INDEX idx_all_full_text',
        ),
    ]
