from django.contrib import admin
from treeherder.model.models import *

class JobTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'job_group', 'symbol', 'active_status']
    list_editable = ['symbol', 'job_group']

admin.site.register(Product)
admin.site.register(BuildPlatform)
admin.site.register(Option)
admin.site.register(RepositoryGroup)
admin.site.register(Repository)
admin.site.register(MachinePlatform)
admin.site.register(Bugscache)
admin.site.register(Machine)
admin.site.register(MachineNote)
admin.site.register(Datasource)
admin.site.register(JobGroup)
admin.site.register(RepositoryVersion)
admin.site.register(OptionCollection)
admin.site.register(JobType, JobTypeAdmin)
admin.site.register(FailureClassification)
