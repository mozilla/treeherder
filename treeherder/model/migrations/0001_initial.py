# -*- coding: utf-8 -*-
from __future__ import unicode_literals

import jsonfield.fields
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
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
                'db_table': 'bugscache',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='BuildPlatform',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('os_name', models.CharField(max_length=25L)),
                ('platform', models.CharField(max_length=25L)),
                ('architecture', models.CharField(max_length=25L, blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'build_platform',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Datasource',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('project', models.CharField(unique=True, max_length=50L)),
                ('name', models.CharField(unique=True, max_length=128L)),
                ('oauth_consumer_key', models.CharField(max_length=45L, null=True, blank=True)),
                ('oauth_consumer_secret', models.CharField(max_length=45L, null=True, blank=True)),
            ],
            options={
                'db_table': 'datasource',
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
                'db_table': 'exclusion_profile',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='FailureClassification',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'failure_classification',
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
                'db_table': 'job_exclusion',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='JobGroup',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('symbol', models.CharField(default='?', max_length=10L)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'job_group',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='JobType',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('symbol', models.CharField(default='?', max_length=10L)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
                ('job_group', models.ForeignKey(blank=True, to='model.JobGroup', null=True)),
            ],
            options={
                'db_table': 'job_type',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Machine',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('first_timestamp', models.IntegerField()),
                ('last_timestamp', models.IntegerField()),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'machine',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='MachinePlatform',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('os_name', models.CharField(max_length=25L)),
                ('platform', models.CharField(max_length=25L)),
                ('architecture', models.CharField(max_length=25L, blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'machine_platform',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Option',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'option',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='OptionCollection',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('option_collection_hash', models.CharField(max_length=40L)),
                ('option', models.ForeignKey(to='model.Option')),
            ],
            options={
                'db_table': 'option_collection',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Product',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'product',
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
                'db_table': 'reference_data_signatures',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='Repository',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('dvcs_type', models.CharField(max_length=25L)),
                ('url', models.CharField(max_length=255L)),
                ('codebase', models.CharField(max_length=50L, blank=True)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'repository',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='RepositoryGroup',
            fields=[
                ('id', models.AutoField(serialize=False, primary_key=True)),
                ('name', models.CharField(max_length=50L)),
                ('description', models.TextField(default='fill me', blank=True)),
                ('active_status', models.CharField(default='active', max_length=7L, blank=True)),
            ],
            options={
                'db_table': 'repository_group',
            },
            bases=(models.Model,),
        ),
        migrations.CreateModel(
            name='UserExclusionProfile',
            fields=[
                ('id', models.AutoField(verbose_name='ID', serialize=False, auto_created=True, primary_key=True)),
                ('is_default', models.BooleanField(default=True)),
                ('exclusion_profile', models.ForeignKey(blank=True, to='model.ExclusionProfile', null=True)),
                ('user', models.ForeignKey(related_name='exclusion_profiles', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'user_exclusion_profile',
            },
            bases=(models.Model,),
        ),
        migrations.AddField(
            model_name='repository',
            name='repository_group',
            field=models.ForeignKey(to='model.RepositoryGroup'),
            preserve_default=True,
        ),
        migrations.AlterUniqueTogether(
            name='optioncollection',
            unique_together=set([('option_collection_hash', 'option')]),
        ),
        migrations.AddField(
            model_name='exclusionprofile',
            name='exclusions',
            field=models.ManyToManyField(related_name='profiles', to='model.JobExclusion'),
            preserve_default=True,
        ),
    ]
