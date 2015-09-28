from django.contrib import admin
from django_browserid.admin import site as browserid_admin

from treeherder.model.models import *


class JobTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'job_group', 'symbol', 'description', 'active_status']
    list_editable = ['symbol', 'job_group']


class ReferenceDataSignatureAdmin(admin.ModelAdmin):
    list_display = ["name", "signature", "build_os_name", "build_platform",
                    "build_architecture", "machine_os_name", "machine_platform",
                    "machine_architecture", "job_group_name", "job_group_symbol",
                    "job_type_name", "job_type_symbol", "option_collection_hash", "build_system_type",
                    "first_submission_timestamp", "review_timestamp", "review_status"]

    search_fields = ["name", "signature", "build_os_name", "build_platform",
                     "build_architecture", "machine_os_name", "machine_platform",
                     "machine_architecture", "job_group_name", "job_group_symbol",
                     "job_type_name", "job_type_symbol", "option_collection_hash", "build_system_type"]


# custom admin classes
browserid_admin.register(JobType, JobTypeAdmin)
browserid_admin.register(Repository)
browserid_admin.register(ReferenceDataSignatures, ReferenceDataSignatureAdmin)
# default admin classes
browserid_admin.register(Product)
browserid_admin.register(BuildPlatform)
browserid_admin.register(Option)
browserid_admin.register(RepositoryGroup)
browserid_admin.register(MachinePlatform)
browserid_admin.register(Bugscache)
browserid_admin.register(Machine)
browserid_admin.register(Datasource)
browserid_admin.register(JobGroup)
browserid_admin.register(OptionCollection)
browserid_admin.register(FailureClassification)
