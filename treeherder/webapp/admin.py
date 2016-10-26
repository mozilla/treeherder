from django.contrib import admin

from treeherder.model.models import *
from treeherder.perf.models import PerformanceFramework


class TreeherderAdminSite(admin.AdminSite):
    site_header = "Treeherder Admin"
    login_template = 'webapp/admin_login.html'

    #: If True, include the normal username and password form as well as
    #: the BrowserID button.
    include_password_form = True


admin_site = TreeherderAdminSite(name="treeherder_admin")


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
admin_site.register(JobType, JobTypeAdmin)
admin_site.register(Repository)
admin_site.register(ReferenceDataSignatures, ReferenceDataSignatureAdmin)
# default admin classes
admin_site.register(Product)
admin_site.register(BuildPlatform)
admin_site.register(Option)
admin_site.register(RepositoryGroup)
admin_site.register(MachinePlatform)
admin_site.register(Bugscache)
admin_site.register(Machine)
admin_site.register(Datasource)
admin_site.register(JobGroup)
admin_site.register(OptionCollection)
admin_site.register(FailureClassification)
admin_site.register(PerformanceFramework)
