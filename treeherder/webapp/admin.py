from django.contrib import admin
from treeherder.model.models import *

from django_browserid.admin import site as browserid_admin


class JobTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'job_group', 'symbol', 'active_status']
    list_editable = ['symbol', 'job_group']

browserid_admin.register(Product)
browserid_admin.register(BuildPlatform)
browserid_admin.register(Option)
browserid_admin.register(RepositoryGroup)
browserid_admin.register(Repository)
browserid_admin.register(MachinePlatform)
browserid_admin.register(Bugscache)
browserid_admin.register(Machine)
browserid_admin.register(MachineNote)
browserid_admin.register(Datasource)
browserid_admin.register(JobGroup)
browserid_admin.register(RepositoryVersion)
browserid_admin.register(OptionCollection)
browserid_admin.register(JobType, JobTypeAdmin)
browserid_admin.register(FailureClassification)
