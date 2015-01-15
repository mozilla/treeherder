# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

# -*- coding: utf-8 -*-

from south.db import db
from south.v2 import SchemaMigration


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'Product'
        db.create_table(u'product', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('description', self.gf('django.db.models.fields.TextField')(default=u'fill me', blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['Product'])

        # Adding model 'BuildPlatform'
        db.create_table(u'build_platform', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('os_name', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('platform', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('architecture', self.gf('django.db.models.fields.CharField')(max_length=25L, blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['BuildPlatform'])

        # Adding model 'Option'
        db.create_table(u'option', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('description', self.gf('django.db.models.fields.TextField')(default=u'fill me', blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['Option'])

        # Adding model 'RepositoryGroup'
        db.create_table(u'repository_group', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('description', self.gf('django.db.models.fields.TextField')(default=u'fill me', blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['RepositoryGroup'])

        # Adding model 'Repository'
        db.create_table(u'repository', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('repository_group', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.RepositoryGroup'])),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('dvcs_type', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('url', self.gf('django.db.models.fields.CharField')(max_length=255L)),
            ('codebase', self.gf('django.db.models.fields.CharField')(max_length=50L, blank=True)),
            ('description', self.gf('django.db.models.fields.TextField')(default=u'fill me', blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['Repository'])

        # Adding model 'MachinePlatform'
        db.create_table(u'machine_platform', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('os_name', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('platform', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('architecture', self.gf('django.db.models.fields.CharField')(max_length=25L, blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['MachinePlatform'])

        # Adding model 'Bugscache'
        db.create_table(u'bugscache', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('status', self.gf('django.db.models.fields.CharField')(max_length=64L, blank=True)),
            ('resolution', self.gf('django.db.models.fields.CharField')(max_length=64L, blank=True)),
            ('summary', self.gf('django.db.models.fields.CharField')(max_length=255L)),
            ('crash_signature', self.gf('django.db.models.fields.TextField')(blank=True)),
            ('keywords', self.gf('django.db.models.fields.TextField')(blank=True)),
            ('os', self.gf('django.db.models.fields.CharField')(max_length=64L, blank=True)),
            ('modified', self.gf('django.db.models.fields.DateTimeField')(null=True, blank=True)),
        ))
        db.send_create_signal(u'model', ['Bugscache'])

        # Adding model 'Machine'
        db.create_table(u'machine', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('first_timestamp', self.gf('django.db.models.fields.IntegerField')()),
            ('last_timestamp', self.gf('django.db.models.fields.IntegerField')()),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['Machine'])

        # Adding model 'MachineNote'
        db.create_table(u'machine_note', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('machine', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.Machine'])),
            ('author', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('machine_timestamp', self.gf('django.db.models.fields.IntegerField')()),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
            ('note', self.gf('django.db.models.fields.TextField')(blank=True)),
        ))
        db.send_create_signal(u'model', ['MachineNote'])

        # Adding model 'Datasource'
        db.create_table(u'datasource', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('project', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('contenttype', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('dataset', self.gf('django.db.models.fields.IntegerField')()),
            ('host', self.gf('django.db.models.fields.CharField')(max_length=128L)),
            ('read_only_host', self.gf('django.db.models.fields.CharField')(max_length=128L, blank=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=128L)),
            ('type', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('oauth_consumer_key', self.gf('django.db.models.fields.CharField')(max_length=45L, null=True, blank=True)),
            ('oauth_consumer_secret', self.gf('django.db.models.fields.CharField')(max_length=45L, null=True, blank=True)),
            ('creation_date', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, blank=True)),
        ))
        db.send_create_signal(u'model', ['Datasource'])

        # Adding unique constraint on 'Datasource', fields ['project', 'dataset', 'contenttype']
        db.create_unique(u'datasource', ['project', 'dataset', 'contenttype'])

        # Adding unique constraint on 'Datasource', fields ['host', 'name']
        db.create_unique(u'datasource', ['host', 'name'])

        # Adding model 'JobGroup'
        db.create_table(u'job_group', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('symbol', self.gf('django.db.models.fields.CharField')(default=u'?', max_length=10L)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('description', self.gf('django.db.models.fields.TextField')(default=u'fill me', blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['JobGroup'])

        # Adding model 'RepositoryVersion'
        db.create_table(u'repository_version', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('repository', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.Repository'])),
            ('version', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('version_timestamp', self.gf('django.db.models.fields.IntegerField')()),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['RepositoryVersion'])

        # Adding model 'OptionCollection'
        db.create_table(u'option_collection', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('option_collection_hash', self.gf('django.db.models.fields.CharField')(max_length=40L)),
            ('option', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.Option'])),
        ))
        db.send_create_signal(u'model', ['OptionCollection'])

        # Adding unique constraint on 'OptionCollection', fields ['option_collection_hash', 'option']
        db.create_unique(u'option_collection', ['option_collection_hash', 'option_id'])

        # Adding model 'JobType'
        db.create_table(u'job_type', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('job_group', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.JobGroup'], null=True, blank=True)),
            ('symbol', self.gf('django.db.models.fields.CharField')(default=u'?', max_length=10L)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('description', self.gf('django.db.models.fields.TextField')(default=u'fill me', blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['JobType'])

        # Adding model 'FailureClassification'
        db.create_table(u'failure_classification', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('description', self.gf('django.db.models.fields.TextField')(default=u'fill me', blank=True)),
            ('active_status', self.gf('django.db.models.fields.CharField')(default=u'active', max_length=7L, blank=True)),
        ))
        db.send_create_signal(u'model', ['FailureClassification'])

        # Adding model 'JobExclusion'
        db.create_table(u'job_exclusion', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(unique=True, max_length=255)),
            ('description', self.gf('django.db.models.fields.TextField')(blank=True)),
            ('info', self.gf('jsonfield.fields.JSONField')()),
            ('author', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['auth.User'])),
        ))
        db.send_create_signal(u'model', ['JobExclusion'])

        # Adding model 'ExclusionProfile'
        db.create_table(u'exclusion_profile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(unique=True, max_length=255)),
            ('is_default', self.gf('django.db.models.fields.BooleanField')(default=False)),
            ('flat_exclusion', self.gf('jsonfield.fields.JSONField')(default={}, blank=True)),
            ('author', self.gf('django.db.models.fields.related.ForeignKey')(related_name=u'exclusion_profiles_authored', to=orm['auth.User'])),
        ))
        db.send_create_signal(u'model', ['ExclusionProfile'])

        # Adding model 'UserExclusionProfile'
        db.create_table(u'user_exclusion_profile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('user', self.gf('django.db.models.fields.related.ForeignKey')(related_name=u'exclusion_profiles', to=orm['auth.User'])),
            ('exclusion_profile', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.ExclusionProfile'], null=True, blank=True)),
            ('is_default', self.gf('django.db.models.fields.BooleanField')(default=True)),
        ))
        db.send_create_signal(u'model', ['UserExclusionProfile'])

        # Adding model 'ExclusionProfileExclusions'
        db.create_table(u'exclusion_profile_exclusions', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('exclusionprofile', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.ExclusionProfile'])),
            ('jobexclusion', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.JobExclusion'])),
        ))
        db.send_create_signal(u'model', ['ExclusionProfileExclusions'])

        # Adding model 'ReferenceDataSignatures'
        db.create_table(u'reference_data_signatures', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(max_length=255L)),
            ('signature', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('build_os_name', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('build_platform', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('build_architecture', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('machine_os_name', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('machine_platform', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('machine_architecture', self.gf('django.db.models.fields.CharField')(max_length=25L)),
            ('device_name', self.gf('django.db.models.fields.CharField')(max_length=50L)),
            ('job_group_name', self.gf('django.db.models.fields.CharField')(max_length=100L, blank=True)),
            ('job_group_symbol', self.gf('django.db.models.fields.CharField')(max_length=25L, blank=True)),
            ('job_type_name', self.gf('django.db.models.fields.CharField')(max_length=100L)),
            ('job_type_symbol', self.gf('django.db.models.fields.CharField')(max_length=25L, blank=True)),
            ('option_collection_hash', self.gf('django.db.models.fields.CharField')(max_length=64L, blank=True)),
            ('build_system_type', self.gf('django.db.models.fields.CharField')(max_length=25L, blank=True)),
            ('first_submission_timestamp', self.gf('django.db.models.fields.IntegerField')()),
            ('review_timestamp', self.gf('django.db.models.fields.IntegerField')(null=True, blank=True)),
            ('review_status', self.gf('django.db.models.fields.CharField')(max_length=12L, blank=True)),
        ))
        db.send_create_signal(u'model', ['ReferenceDataSignatures'])


    def backwards(self, orm):
        # Removing unique constraint on 'OptionCollection', fields ['option_collection_hash', 'option']
        db.delete_unique(u'option_collection', ['option_collection_hash', 'option_id'])

        # Removing unique constraint on 'Datasource', fields ['host', 'name']
        db.delete_unique(u'datasource', ['host', 'name'])

        # Removing unique constraint on 'Datasource', fields ['project', 'dataset', 'contenttype']
        db.delete_unique(u'datasource', ['project', 'dataset', 'contenttype'])

        # Deleting model 'Product'
        db.delete_table(u'product')

        # Deleting model 'BuildPlatform'
        db.delete_table(u'build_platform')

        # Deleting model 'Option'
        db.delete_table(u'option')

        # Deleting model 'RepositoryGroup'
        db.delete_table(u'repository_group')

        # Deleting model 'Repository'
        db.delete_table(u'repository')

        # Deleting model 'MachinePlatform'
        db.delete_table(u'machine_platform')

        # Deleting model 'Bugscache'
        db.delete_table(u'bugscache')

        # Deleting model 'Machine'
        db.delete_table(u'machine')

        # Deleting model 'MachineNote'
        db.delete_table(u'machine_note')

        # Deleting model 'Datasource'
        db.delete_table(u'datasource')

        # Deleting model 'JobGroup'
        db.delete_table(u'job_group')

        # Deleting model 'RepositoryVersion'
        db.delete_table(u'repository_version')

        # Deleting model 'OptionCollection'
        db.delete_table(u'option_collection')

        # Deleting model 'JobType'
        db.delete_table(u'job_type')

        # Deleting model 'FailureClassification'
        db.delete_table(u'failure_classification')

        # Deleting model 'JobExclusion'
        db.delete_table(u'job_exclusion')

        # Deleting model 'ExclusionProfile'
        db.delete_table(u'exclusion_profile')

        # Deleting model 'UserExclusionProfile'
        db.delete_table(u'user_exclusion_profile')

        # Deleting model 'ExclusionProfileExclusions'
        db.delete_table(u'exclusion_profile_exclusions')

        # Deleting model 'ReferenceDataSignatures'
        db.delete_table(u'reference_data_signatures')


    models = {
        u'auth.group': {
            'Meta': {'object_name': 'Group'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '80'}),
            'permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'})
        },
        u'auth.permission': {
            'Meta': {'ordering': "(u'content_type__app_label', u'content_type__model', u'codename')", 'unique_together': "((u'content_type', u'codename'),)", 'object_name': 'Permission'},
            'codename': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'content_type': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['contenttypes.ContentType']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'})
        },
        u'auth.user': {
            'Meta': {'object_name': 'User'},
            'date_joined': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'email': ('django.db.models.fields.EmailField', [], {'max_length': '75', 'blank': 'True'}),
            'first_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'groups': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Group']", 'symmetrical': 'False', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'is_staff': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'is_superuser': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'last_login': ('django.db.models.fields.DateTimeField', [], {'default': 'datetime.datetime.now'}),
            'last_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'blank': 'True'}),
            'password': ('django.db.models.fields.CharField', [], {'max_length': '128'}),
            'user_permissions': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['auth.Permission']", 'symmetrical': 'False', 'blank': 'True'}),
            'username': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '30'})
        },
        u'contenttypes.contenttype': {
            'Meta': {'ordering': "('name',)", 'unique_together': "(('app_label', 'model'),)", 'object_name': 'ContentType', 'db_table': "'django_content_type'"},
            'app_label': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'model': ('django.db.models.fields.CharField', [], {'max_length': '100'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '100'})
        },
        u'model.bugscache': {
            'Meta': {'object_name': 'Bugscache', 'db_table': "u'bugscache'"},
            'crash_signature': ('django.db.models.fields.TextField', [], {'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'keywords': ('django.db.models.fields.TextField', [], {'blank': 'True'}),
            'modified': ('django.db.models.fields.DateTimeField', [], {'null': 'True', 'blank': 'True'}),
            'os': ('django.db.models.fields.CharField', [], {'max_length': '64L', 'blank': 'True'}),
            'resolution': ('django.db.models.fields.CharField', [], {'max_length': '64L', 'blank': 'True'}),
            'status': ('django.db.models.fields.CharField', [], {'max_length': '64L', 'blank': 'True'}),
            'summary': ('django.db.models.fields.CharField', [], {'max_length': '255L'})
        },
        u'model.buildplatform': {
            'Meta': {'object_name': 'BuildPlatform', 'db_table': "u'build_platform'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'architecture': ('django.db.models.fields.CharField', [], {'max_length': '25L', 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'os_name': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '25L'})
        },
        u'model.datasource': {
            'Meta': {'unique_together': "[[u'project', u'dataset', u'contenttype'], [u'host', u'name']]", 'object_name': 'Datasource', 'db_table': "u'datasource'"},
            'contenttype': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'creation_date': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'dataset': ('django.db.models.fields.IntegerField', [], {}),
            'host': ('django.db.models.fields.CharField', [], {'max_length': '128L'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '128L'}),
            'oauth_consumer_key': ('django.db.models.fields.CharField', [], {'max_length': '45L', 'null': 'True', 'blank': 'True'}),
            'oauth_consumer_secret': ('django.db.models.fields.CharField', [], {'max_length': '45L', 'null': 'True', 'blank': 'True'}),
            'project': ('django.db.models.fields.CharField', [], {'max_length': '50L'}),
            'read_only_host': ('django.db.models.fields.CharField', [], {'max_length': '128L', 'blank': 'True'}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '25L'})
        },
        u'model.exclusionprofile': {
            'Meta': {'object_name': 'ExclusionProfile', 'db_table': "u'exclusion_profile'"},
            'author': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "u'exclusion_profiles_authored'", 'to': u"orm['auth.User']"}),
            'exclusions': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'profiles'", 'symmetrical': 'False', 'through': u"orm['model.ExclusionProfileExclusions']", 'to': u"orm['model.JobExclusion']"}),
            'flat_exclusion': ('jsonfield.fields.JSONField', [], {'default': '{}', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_default': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '255'})
        },
        u'model.exclusionprofileexclusions': {
            'Meta': {'object_name': 'ExclusionProfileExclusions', 'db_table': "u'exclusion_profile_exclusions'"},
            'exclusionprofile': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.ExclusionProfile']"}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'jobexclusion': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.JobExclusion']"})
        },
        u'model.failureclassification': {
            'Meta': {'object_name': 'FailureClassification', 'db_table': "u'failure_classification'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'description': ('django.db.models.fields.TextField', [], {'default': "u'fill me'", 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'})
        },
        u'model.jobexclusion': {
            'Meta': {'object_name': 'JobExclusion', 'db_table': "u'job_exclusion'"},
            'author': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['auth.User']"}),
            'description': ('django.db.models.fields.TextField', [], {'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'info': ('jsonfield.fields.JSONField', [], {}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '255'})
        },
        u'model.jobgroup': {
            'Meta': {'object_name': 'JobGroup', 'db_table': "u'job_group'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'description': ('django.db.models.fields.TextField', [], {'default': "u'fill me'", 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'}),
            'symbol': ('django.db.models.fields.CharField', [], {'default': "u'?'", 'max_length': '10L'})
        },
        u'model.jobtype': {
            'Meta': {'object_name': 'JobType', 'db_table': "u'job_type'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'description': ('django.db.models.fields.TextField', [], {'default': "u'fill me'", 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'job_group': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.JobGroup']", 'null': 'True', 'blank': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'}),
            'symbol': ('django.db.models.fields.CharField', [], {'default': "u'?'", 'max_length': '10L'})
        },
        u'model.machine': {
            'Meta': {'object_name': 'Machine', 'db_table': "u'machine'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'first_timestamp': ('django.db.models.fields.IntegerField', [], {}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_timestamp': ('django.db.models.fields.IntegerField', [], {}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'})
        },
        u'model.machinenote': {
            'Meta': {'object_name': 'MachineNote', 'db_table': "u'machine_note'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'author': ('django.db.models.fields.CharField', [], {'max_length': '50L'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'machine': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.Machine']"}),
            'machine_timestamp': ('django.db.models.fields.IntegerField', [], {}),
            'note': ('django.db.models.fields.TextField', [], {'blank': 'True'})
        },
        u'model.machineplatform': {
            'Meta': {'object_name': 'MachinePlatform', 'db_table': "u'machine_platform'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'architecture': ('django.db.models.fields.CharField', [], {'max_length': '25L', 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'os_name': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'platform': ('django.db.models.fields.CharField', [], {'max_length': '25L'})
        },
        u'model.option': {
            'Meta': {'object_name': 'Option', 'db_table': "u'option'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'description': ('django.db.models.fields.TextField', [], {'default': "u'fill me'", 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'})
        },
        u'model.optioncollection': {
            'Meta': {'unique_together': "([u'option_collection_hash', u'option'],)", 'object_name': 'OptionCollection', 'db_table': "u'option_collection'"},
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'option': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.Option']"}),
            'option_collection_hash': ('django.db.models.fields.CharField', [], {'max_length': '40L'})
        },
        u'model.product': {
            'Meta': {'object_name': 'Product', 'db_table': "u'product'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'description': ('django.db.models.fields.TextField', [], {'default': "u'fill me'", 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'})
        },
        u'model.referencedatasignatures': {
            'Meta': {'object_name': 'ReferenceDataSignatures', 'db_table': "u'reference_data_signatures'"},
            'build_architecture': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'build_os_name': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'build_platform': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'build_system_type': ('django.db.models.fields.CharField', [], {'max_length': '25L', 'blank': 'True'}),
            'device_name': ('django.db.models.fields.CharField', [], {'max_length': '50L'}),
            'first_submission_timestamp': ('django.db.models.fields.IntegerField', [], {}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'job_group_name': ('django.db.models.fields.CharField', [], {'max_length': '100L', 'blank': 'True'}),
            'job_group_symbol': ('django.db.models.fields.CharField', [], {'max_length': '25L', 'blank': 'True'}),
            'job_type_name': ('django.db.models.fields.CharField', [], {'max_length': '100L'}),
            'job_type_symbol': ('django.db.models.fields.CharField', [], {'max_length': '25L', 'blank': 'True'}),
            'machine_architecture': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'machine_os_name': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'machine_platform': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '255L'}),
            'option_collection_hash': ('django.db.models.fields.CharField', [], {'max_length': '64L', 'blank': 'True'}),
            'review_status': ('django.db.models.fields.CharField', [], {'max_length': '12L', 'blank': 'True'}),
            'review_timestamp': ('django.db.models.fields.IntegerField', [], {'null': 'True', 'blank': 'True'}),
            'signature': ('django.db.models.fields.CharField', [], {'max_length': '50L'})
        },
        u'model.repository': {
            'Meta': {'object_name': 'Repository', 'db_table': "u'repository'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'codebase': ('django.db.models.fields.CharField', [], {'max_length': '50L', 'blank': 'True'}),
            'description': ('django.db.models.fields.TextField', [], {'default': "u'fill me'", 'blank': 'True'}),
            'dvcs_type': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'}),
            'repository_group': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.RepositoryGroup']"}),
            'url': ('django.db.models.fields.CharField', [], {'max_length': '255L'})
        },
        u'model.repositorygroup': {
            'Meta': {'object_name': 'RepositoryGroup', 'db_table': "u'repository_group'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'description': ('django.db.models.fields.TextField', [], {'default': "u'fill me'", 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'})
        },
        u'model.repositoryversion': {
            'Meta': {'object_name': 'RepositoryVersion', 'db_table': "u'repository_version'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'repository': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.Repository']"}),
            'version': ('django.db.models.fields.CharField', [], {'max_length': '50L'}),
            'version_timestamp': ('django.db.models.fields.IntegerField', [], {})
        },
        u'model.userexclusionprofile': {
            'Meta': {'object_name': 'UserExclusionProfile', 'db_table': "u'user_exclusion_profile'"},
            'exclusion_profile': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.ExclusionProfile']", 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_default': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "u'exclusion_profiles'", 'to': u"orm['auth.User']"})
        }
    }

    complete_apps = ['model']
