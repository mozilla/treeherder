from django.contrib import admin
from treeherder.model.models import *
from django.core.cache import cache

from django_browserid.admin import site as browserid_admin


class JobTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'job_group', 'symbol', 'description', 'active_status']
    list_editable = ['symbol', 'job_group']


class ReferenceDataSignatureAdmin(admin.ModelAdmin):
    list_display = ["name", "signature", "build_os_name", "build_platform",
                    "build_architecture", "machine_os_name", "machine_platform",
                    "machine_architecture", "device_name", "job_group_name", "job_group_symbol",
                    "job_type_name", "job_type_symbol", "option_collection_hash", "build_system_type",
                    "first_submission_timestamp", "review_timestamp", "review_status"]

    search_fields = ["name", "signature", "build_os_name", "build_platform",
                    "build_architecture", "machine_os_name", "machine_platform",
                    "machine_architecture", "device_name", "job_group_name", "job_group_symbol",
                    "job_type_name", "job_type_symbol", "option_collection_hash", "build_system_type"]


class RepositoryAdmin(admin.ModelAdmin):
    actions = ['clear_repo_cache']

    def clear_repo_cache(self, request, queryset):
        repo_list = queryset.values_list("name", flat=True)
        cache_key_list = ["{0}:last_push".format(repo) for repo in repo_list]
        cache.delete_many(cache_key_list)
        self.message_user(request, "Pushlog cache successfully deleted.")
    clear_repo_cache.short_description = "Clear the pushlog cache for selected repositories"


# custom admin classes
browserid_admin.register(JobType, JobTypeAdmin)
browserid_admin.register(Repository, RepositoryAdmin)
browserid_admin.register(ReferenceDataSignatures, ReferenceDataSignatureAdmin)
# default admin classes
browserid_admin.register(Product)
browserid_admin.register(BuildPlatform)
browserid_admin.register(Option)
browserid_admin.register(RepositoryGroup)
browserid_admin.register(MachinePlatform)
browserid_admin.register(Bugscache)
browserid_admin.register(Machine)
browserid_admin.register(MachineNote)
browserid_admin.register(Datasource)
browserid_admin.register(JobGroup)
browserid_admin.register(RepositoryVersion)
browserid_admin.register(OptionCollection)
browserid_admin.register(FailureClassification)
