from django.conf.urls import (include,
                              url)
from rest_framework import routers

from treeherder.webapp.api import (artifact,
                                   bug,
                                   job_log_url,
                                   jobs,
                                   logslice,
                                   note,
                                   performance_data,
                                   refdata,
                                   resultset,
                                   runnable_jobs)

# router for views that are bound to a project
# i.e. all those views that don't involve reference data
project_bound_router = routers.SimpleRouter()

project_bound_router.register(
    r'jobs',
    jobs.JobsViewSet,
    base_name='jobs',
)

project_bound_router.register(
    r'runnable_jobs',
    runnable_jobs.RunnableJobsViewSet,
    base_name='runnable_jobs',
)

project_bound_router.register(
    r'resultset',
    resultset.ResultSetViewSet,
    base_name='resultset',
)

project_bound_router.register(
    r'artifact',
    artifact.ArtifactViewSet,
    base_name='artifact',
)

project_bound_router.register(
    r'note',
    note.NoteViewSet,
    base_name='note',
)

project_bound_router.register(
    r'bug-job-map',
    bug.BugJobMapViewSet,
    base_name='bug-job-map',
)

project_bound_router.register(
    r'logslice',
    logslice.LogSliceView,
    base_name='logslice',
)

project_bound_router.register(
    r'job-log-url',
    job_log_url.JobLogUrlViewSet,
    base_name='job-log-url',
)

project_bound_router.register(
    r'performance/data',
    performance_data.PerformanceDatumViewSet,
    base_name='performance-data')

project_bound_router.register(
    r'performance/signatures',
    performance_data.PerformanceSignatureViewSet,
    base_name='performance-signatures')

project_bound_router.register(
    r'performance/platforms',
    performance_data.PerformancePlatformViewSet,
    base_name='performance-signatures-platforms')

# this is the default router for plain restful endpoints

# refdata endpoints:
default_router = routers.DefaultRouter()
default_router.register(r'product', refdata.ProductViewSet)
default_router.register(r'machine', refdata.MachineViewSet)
default_router.register(r'machineplatform', refdata.MachinePlatformViewSet)
default_router.register(r'buildplatform', refdata.BuildPlatformViewSet)
default_router.register(r'jobgroup', refdata.JobGroupViewSet)
default_router.register(r'jobtype', refdata.JobTypeViewSet)
default_router.register(r'repository', refdata.RepositoryViewSet)
default_router.register(r'optioncollectionhash', refdata.OptionCollectionHashViewSet,
                        base_name='optioncollectionhash')
default_router.register(r'bugscache', refdata.BugscacheViewSet)
default_router.register(r'failureclassification', refdata.FailureClassificationViewSet)
default_router.register(r'user', refdata.UserViewSet, base_name='user')
default_router.register(r'exclusion-profile', refdata.ExclusionProfileViewSet)
default_router.register(r'job-exclusion', refdata.JobExclusionViewSet)
default_router.register(r'matcher', refdata.MatcherViewSet)
default_router.register(r'performance/alertsummary',
                        performance_data.PerformanceAlertSummaryViewSet,
                        base_name='performance-alert-summaries')
default_router.register(r'performance/alert',
                        performance_data.PerformanceAlertViewSet,
                        base_name='performance-alerts')
default_router.register(r'performance/framework',
                        performance_data.PerformanceFrameworkViewSet,
                        base_name='performance-frameworks')

urlpatterns = [
    url(r'^project/(?P<project>[\w-]{0,50})/',
        include(project_bound_router.urls)),
    url(r'^',
        include(default_router.urls)),
]
