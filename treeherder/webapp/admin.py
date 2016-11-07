from django.contrib import admin

from treeherder.model.models import *
from treeherder.perf.models import PerformanceFramework


class JobTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'job_group', 'symbol', 'description']
    list_editable = ['symbol', 'job_group']


class ReferenceDataSignatureAdmin(admin.ModelAdmin):
    list_display = ["name", "signature", "build_os_name", "build_platform",
                    "build_architecture", "machine_os_name", "machine_platform",
                    "machine_architecture", "job_group_name", "job_group_symbol",
                    "job_type_name", "job_type_symbol", "option_collection_hash", "build_system_type",
                    "first_submission_timestamp"]

    search_fields = ["name", "signature", "build_os_name", "build_platform",
                     "build_architecture", "machine_os_name", "machine_platform",
                     "machine_architecture", "job_group_name", "job_group_symbol",
                     "job_type_name", "job_type_symbol", "option_collection_hash", "build_system_type"]


# custom admin classes
admin.site.register(JobType, JobTypeAdmin)
admin.site.register(Repository)
admin.site.register(ReferenceDataSignatures, ReferenceDataSignatureAdmin)
# default admin classes
admin.site.register(Product)
admin.site.register(BuildPlatform)
admin.site.register(Option)
admin.site.register(RepositoryGroup)
admin.site.register(MachinePlatform)
admin.site.register(Bugscache)
admin.site.register(Machine)
admin.site.register(Datasource)
admin.site.register(JobGroup)
admin.site.register(OptionCollection)
admin.site.register(FailureClassification)
admin.site.register(PerformanceFramework)
