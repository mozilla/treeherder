# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'UserExclusionProfile'
        db.create_table(u'model_userexclusionprofile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('user', self.gf('django.db.models.fields.related.ForeignKey')(related_name=u'exclusion_profiles', to=orm['auth.User'])),
            ('exclusion_profile', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['model.ExclusionProfile'], null=True, blank=True)),
            ('is_default', self.gf('django.db.models.fields.BooleanField')(default=True)),
        ))
        db.send_create_signal(u'model', ['UserExclusionProfile'])

        # Adding model 'ExclusionProfile'
        db.create_table(u'model_exclusionprofile', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(unique=True, max_length=255)),
            ('is_default', self.gf('django.db.models.fields.BooleanField')(default=False)),
            ('flat_exclusion', self.gf('jsonfield.fields.JSONField')(default={}, blank=True)),
            ('author', self.gf('django.db.models.fields.related.ForeignKey')(related_name=u'exclusion_profiles_authored', to=orm['auth.User'])),
        ))
        db.send_create_signal(u'model', ['ExclusionProfile'])

        # Adding M2M table for field filters on 'ExclusionProfile'
        db.create_table(u'model_exclusionprofile_filters', (
            ('id', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True)),
            ('exclusionprofile', models.ForeignKey(orm[u'model.exclusionprofile'], null=False)),
            ('jobfilter', models.ForeignKey(orm[u'model.jobfilter'], null=False))
        ))
        db.create_unique(u'model_exclusionprofile_filters', ['exclusionprofile_id', 'jobfilter_id'])

        # Adding model 'JobFilter'
        db.create_table(u'model_jobfilter', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('name', self.gf('django.db.models.fields.CharField')(unique=True, max_length=255)),
            ('description', self.gf('django.db.models.fields.TextField')(blank=True)),
            ('info', self.gf('jsonfield.fields.JSONField')()),
            ('author', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['auth.User'])),
        ))
        db.send_create_signal(u'model', ['JobFilter'])


    def backwards(self, orm):
        # Deleting model 'UserExclusionProfile'
        db.delete_table(u'model_userexclusionprofile')

        # Deleting model 'ExclusionProfile'
        db.delete_table(u'model_exclusionprofile')

        # Removing M2M table for field filters on 'ExclusionProfile'
        db.delete_table('model_exclusionprofile_filters')

        # Deleting model 'JobFilter'
        db.delete_table(u'model_jobfilter')


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
            'project': ('django.db.models.fields.CharField', [], {'max_length': '25L'}),
            'read_only_host': ('django.db.models.fields.CharField', [], {'max_length': '128L', 'blank': 'True'}),
            'type': ('django.db.models.fields.CharField', [], {'max_length': '25L'})
        },
        u'model.exclusionprofile': {
            'Meta': {'object_name': 'ExclusionProfile'},
            'author': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "u'exclusion_profiles_authored'", 'to': u"orm['auth.User']"}),
            'filters': ('django.db.models.fields.related.ManyToManyField', [], {'related_name': "u'profiles'", 'symmetrical': 'False', 'to': u"orm['model.JobFilter']"}),
            'flat_exclusion': ('jsonfield.fields.JSONField', [], {'default': '{}', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_default': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'name': ('django.db.models.fields.CharField', [], {'unique': 'True', 'max_length': '255'})
        },
        u'model.failureclassification': {
            'Meta': {'object_name': 'FailureClassification', 'db_table': "u'failure_classification'"},
            'active_status': ('django.db.models.fields.CharField', [], {'default': "u'active'", 'max_length': '7L', 'blank': 'True'}),
            'description': ('django.db.models.fields.TextField', [], {'default': "u'fill me'", 'blank': 'True'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50L'})
        },
        u'model.jobfilter': {
            'Meta': {'object_name': 'JobFilter'},
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
            'Meta': {'object_name': 'UserExclusionProfile'},
            'exclusion_profile': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['model.ExclusionProfile']", 'null': 'True', 'blank': 'True'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_default': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'user': ('django.db.models.fields.related.ForeignKey', [], {'related_name': "u'exclusion_profiles'", 'to': u"orm['auth.User']"})
        }
    }

    complete_apps = ['model']