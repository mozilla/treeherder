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
            name='BugJobMap',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('bug_id', models.IntegerField(db_index=True)),
                ('submit_timestamp', models.IntegerField(db_index=True)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Bugscache',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('status', models.CharField(max_length=64L, blank=True)),
                ('resolution', models.CharField(max_length=64L, blank=True)),
                ('summary', models.CharField(max_length=255L)),
                ('crash_signature', models.TextField(blank=True)),
                ('keywords', models.TextField(blank=True)),
                ('os', models.CharField(max_length=64L, blank=True)),
                ('modified', models.DateTimeField(null=True, blank=True)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='BuildPlatform',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('os_name', models.CharField(max_length=25L)),
                ('platform', models.CharField(max_length=25L)),
                ('architecture', models.CharField(max_length=25L, blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Device',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default=b'fill me', blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='ExclusionProfile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(unique=True, max_length=255)),
                ('is_default', models.BooleanField(default=False)),
                ('flat_exclusion', jsonfield.fields.JSONField(default={}, blank=True)),
                ('author', models.ForeignKey(related_name='exclusion_profiles_authored', to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='FailureClassification',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default=b'fill me', blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Job',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('job_guid', models.CharField(max_length=50, db_index=True)),
                ('signature', models.CharField(max_length=50, blank=True)),
                ('job_coalesced_to_guid', models.CharField(db_index=True, max_length=50, null=True, blank=True)),
                ('who', models.CharField(max_length=50, db_index=True)),
                ('reason', models.CharField(max_length=125, db_index=True)),
                ('result', models.CharField(db_index=True, max_length=25, null=True, blank=True)),
                ('state', models.CharField(max_length=25, db_index=True)),
                ('submit_timestamp', models.IntegerField(db_index=True)),
                ('start_timestamp', models.IntegerField(db_index=True, null=True, blank=True)),
                ('end_timestamp', models.IntegerField(db_index=True, null=True, blank=True)),
                ('last_modified', models.DateTimeField(auto_now=True, db_index=True)),
                ('pending_eta', models.IntegerField(db_index=True, null=True, blank=True)),
                ('running_eta', models.IntegerField(db_index=True, null=True, blank=True)),
                ('tier', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('build_platform', models.ForeignKey(to='django_ci.BuildPlatform')),
                ('device', models.ForeignKey(blank=True, to='django_ci.Device', null=True)),
                ('failure_classification', models.ForeignKey(to='django_ci.FailureClassification')),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='JobArtifact',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('type', models.CharField(max_length=50, db_index=True)),
                ('blob', models.TextField()),
                ('url', models.URLField(null=True, blank=True)),
                ('job', models.ForeignKey(to='django_ci.Job')),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='JobEta',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('signature', models.CharField(max_length=50, db_index=True)),
                ('state', models.CharField(max_length=25, db_index=True)),
                ('avg_sec', models.IntegerField()),
                ('median_sec', models.IntegerField()),
                ('min_sec', models.IntegerField()),
                ('max_sec', models.IntegerField()),
                ('std', models.IntegerField()),
                ('sample_count', models.IntegerField()),
                ('submit_timestamp', models.IntegerField()),
            ],
            options={
            },
            bases=(models.Model,),
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
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='JobGroup',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('symbol', models.CharField(default=b'?', max_length=10L)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default=b'fill me', blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='JobLogUrl',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('url', models.CharField(max_length=255, db_index=True)),
                ('parse_status', models.CharField(default=1, max_length=7, db_index=True, blank=True, choices=[(1, b'pending'), (2, b'parsed'), (3, b'failed')])),
                ('parse_timestamp', models.IntegerField()),
                ('job', models.ForeignKey(to='django_ci.Job')),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='JobNote',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('who', models.CharField(max_length=50, db_index=True)),
                ('note', models.TextField(blank=True)),
                ('note_timestamp', models.IntegerField(db_index=True)),
                ('failure_classification', models.ForeignKey(blank=True, to='django_ci.FailureClassification', null=True)),
                ('job', models.ForeignKey(to='django_ci.Job')),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='JobType',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('symbol', models.CharField(default=b'?', max_length=10L)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default=b'fill me', blank=True)),
                ('job_group', models.ForeignKey(blank=True, to='django_ci.JobGroup', null=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Machine',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('first_timestamp', models.IntegerField()),
                ('last_timestamp', models.IntegerField()),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='MachinePlatform',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('os_name', models.CharField(max_length=25L)),
                ('platform', models.CharField(max_length=25L)),
                ('architecture', models.CharField(max_length=25L, blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Option',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default=b'fill me', blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='OptionCollection',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('option_collection_hash', models.CharField(max_length=40L)),
                ('option', models.ForeignKey(to='django_ci.Option')),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='PerformanceArtifact',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('series_signature', models.CharField(max_length=50, db_index=True)),
                ('name', models.CharField(max_length=50, db_index=True)),
                ('type', models.CharField(max_length=50, db_index=True)),
                ('blob', models.TextField()),
                ('job', models.ForeignKey(to='django_ci.Job')),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='PerformanceSeries',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('interval_seconds', models.IntegerField(db_index=True)),
                ('series_signature', models.CharField(max_length=50, db_index=True)),
                ('type', models.CharField(max_length=50, db_index=True)),
                ('last_updated', models.IntegerField(db_index=True)),
                ('blob', models.TextField()),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Product',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default=b'fill me', blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='ReferenceDataSignatures',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('name', models.CharField(max_length=255L)),
                ('signature', models.CharField(max_length=50L)),
                ('build_os_name', models.CharField(max_length=25L)),
                ('build_platform', models.CharField(max_length=25L)),
                ('build_architecture', models.CharField(max_length=25L)),
                ('machine_os_name', models.CharField(max_length=25L)),
                ('machine_platform', models.CharField(max_length=25L)),
                ('machine_architecture', models.CharField(max_length=25L)),
                ('device_name', models.CharField(max_length=50L)),
                ('job_group_name', models.CharField(max_length=100L, blank=True)),
                ('job_group_symbol', models.CharField(max_length=25L, blank=True)),
                ('job_type_name', models.CharField(max_length=100L)),
                ('job_type_symbol', models.CharField(max_length=25L, blank=True)),
                ('option_collection_hash', models.CharField(max_length=64L, blank=True)),
                ('build_system_type', models.CharField(max_length=25L, blank=True)),
                ('repository', models.CharField(max_length=50L)),
                ('first_submission_timestamp', models.IntegerField()),
                ('review_timestamp', models.IntegerField(null=True, blank=True)),
                ('review_status', models.CharField(max_length=12L, blank=True)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Repository',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('dvcs_type', models.CharField(max_length=25L)),
                ('url', models.CharField(max_length=255L)),
                ('codebase', models.CharField(max_length=50L, blank=True)),
                ('description', models.TextField(default=b'fill me', blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='RepositoryGroup',
            fields=[
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default=b'fill me', blank=True)),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='ResultSet',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('revision_hash', models.CharField(unique=True, max_length=50)),
                ('author', models.CharField(max_length=150, db_index=True)),
                ('push_timestamp', models.IntegerField(db_index=True)),
                ('repository', models.ForeignKey(to='django_ci.Repository')),
            ],
            options={
                'abstract': False,
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Revision',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('active_status', models.PositiveSmallIntegerField(default=1, db_index=True)),
                ('revision', models.CharField(max_length=50)),
                ('author', models.CharField(max_length=150, db_index=True)),
                ('comments', models.TextField(blank=True)),
                ('commit_timestamp', models.IntegerField(db_index=True, null=True, blank=True)),
                ('files', models.TextField(blank=True)),
                ('repository', models.ForeignKey(to='django_ci.Repository')),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='UserExclusionProfile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('is_default', models.BooleanField(default=True)),
                ('exclusion_profile', models.ForeignKey(blank=True, to='django_ci.ExclusionProfile', null=True)),
                ('user', models.ForeignKey(related_name='exclusion_profiles', to=settings.AUTH_USER_MODEL)),
            ],
            options={
            },
            bases=(models.Model,),
        ),
        migrations.AlterUniqueTogether(
            name='revision',
            unique_together=set([('revision', 'repository')]),
        ),
        migrations.AddField(
            model_name='resultset',
            name='revisions',
            field=models.ManyToManyField(related_name='result_sets', to='django_ci.Revision'),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='repository',
            name='repository_group',
            field=models.ForeignKey(to='django_ci.RepositoryGroup'),
            preserve_default=True,
        ),
        migrations.AlterUniqueTogether(
            name='optioncollection',
            unique_together=set([('option_collection_hash', 'option')]),
        ),
        migrations.AddField(
            model_name='job',
            name='job_type',
            field=models.ForeignKey(to='django_ci.JobType'),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='job',
            name='machine',
            field=models.ForeignKey(blank=True, to='django_ci.Machine', null=True),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='job',
            name='machine_platform',
            field=models.ForeignKey(to='django_ci.MachinePlatform'),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='job',
            name='option_collection',
            field=models.ForeignKey(blank=True, to='django_ci.OptionCollection', null=True),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='job',
            name='product',
            field=models.ForeignKey(blank=True, to='django_ci.Product', null=True),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='job',
            name='repository',
            field=models.ForeignKey(to='django_ci.Repository'),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='job',
            name='result_set',
            field=models.ForeignKey(to='django_ci.ResultSet'),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='exclusionprofile',
            name='exclusions',
            field=models.ManyToManyField(related_name='profiles', to='django_ci.JobExclusion'),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='bugjobmap',
            name='job',
            field=models.ForeignKey(to='django_ci.Job'),
            preserve_default=True,
        ),
        migrations.AddField(
            model_name='bugjobmap',
            name='who',
            field=models.ForeignKey(to=settings.AUTH_USER_MODEL),
            preserve_default=True,
        ),
        migrations.AlterUniqueTogether(
            name='bugjobmap',
            unique_together=set([('job', 'bug_id')]),
        ),
    ]
