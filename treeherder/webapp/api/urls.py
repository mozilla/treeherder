import copy

from django.conf.urls import include, url
from rest_framework import routers

from treeherder.webapp.api import (
    auth,
    bug,
    bugzilla,
    changelog,
    csp_report,
    intermittents_view,
    job_log_url,
    jobs,
    machine_platforms,
    note,
    performance_data,
    push,
    refdata,
    seta,
    text_log_error,
)

# router for views that are bound to a project
# i.e. all those views that don't involve reference data
# DEPRECATED: We will be slowly transitioning away from this router
# in favor of a router that does not require the ``project`` property.
project_bound_router = routers.SimpleRouter()

# DEPRECATED (in process): The UI is transitioning to the /jobs/ endpoint
# from the default_router.
project_bound_router.register(
    r'jobs', jobs.JobsProjectViewSet, basename='jobs',
)

project_bound_router.register(
    r'seta/job-priorities', seta.SetaJobPriorityViewSet, basename='seta-job-priorities'
)

project_bound_router.register(
    r'push', push.PushViewSet, basename='push',
)

project_bound_router.register(
    r'note', note.NoteViewSet, basename='note',
)

project_bound_router.register(
    r'bug-job-map', bug.BugJobMapViewSet, basename='bug-job-map',
)

project_bound_router.register(
    r'job-log-url', job_log_url.JobLogUrlViewSet, basename='job-log-url',
)

project_bound_router.register(
    r'performance/data', performance_data.PerformanceDatumViewSet, basename='performance-data'
)

project_bound_router.register(
    r'performance/signatures',
    performance_data.PerformanceSignatureViewSet,
    basename='performance-signatures',
)

project_bound_router.register(
    r'performance/platforms',
    performance_data.PerformancePlatformViewSet,
    basename='performance-signatures-platforms',
)


class TextLogErrorRouter(routers.DefaultRouter):
    """
    TextLogError specific router

    The TLE endpoints accept PUT to a non-detail endpoint (no PK/ID in the
    URL).  This router tells DRF to route those calls to a ViewSet's
    `update_many` method.
    """

    routes = copy.deepcopy(routers.DefaultRouter.routes)
    routes[0].mapping[u"put"] = u"update_many"


tle_router = TextLogErrorRouter()
tle_router.register(
    r'text-log-error', text_log_error.TextLogErrorViewSet, basename='text-log-error'
)


# refdata endpoints:
default_router = routers.DefaultRouter()
default_router.register(r'jobs', jobs.JobsViewSet, basename='jobs')
default_router.register(r'repository', refdata.RepositoryViewSet)
default_router.register(
    r'taskclustermetadata', refdata.TaskclusterMetadataViewSet, basename='taskclustermetadata'
)
default_router.register(
    r'optioncollectionhash', refdata.OptionCollectionHashViewSet, basename='optioncollectionhash'
)
default_router.register(r'failureclassification', refdata.FailureClassificationViewSet)
default_router.register(r'user', refdata.UserViewSet, basename='user')
default_router.register(
    r'machineplatforms', machine_platforms.MachinePlatformsViewSet, basename='machineplatforms'
)
default_router.register(
    r'performance/alertsummary',
    performance_data.PerformanceAlertSummaryViewSet,
    basename='performance-alert-summaries',
)
default_router.register(
    r'performance/alert', performance_data.PerformanceAlertViewSet, basename='performance-alerts'
)
default_router.register(
    r'performance/framework',
    performance_data.PerformanceFrameworkViewSet,
    basename='performance-frameworks',
)
default_router.register(
    r'performance/bug-template',
    performance_data.PerformanceBugTemplateViewSet,
    basename='performance-bug-template',
)
default_router.register(
    r'performance/issue-tracker',
    performance_data.PerformanceIssueTrackerViewSet,
    basename='performance-issue-tracker',
)
default_router.register(
    r'performance/validity-dashboard',
    performance_data.TestSuiteHealthViewSet,
    basename='validity-dashboard',
)
default_router.register(r'bugzilla', bugzilla.BugzillaViewSet, basename='bugzilla')
default_router.register(r'jobdetail', jobs.JobDetailViewSet, basename='jobdetail')
default_router.register(r'auth', auth.AuthViewSet, basename='auth')
default_router.register(r'changelog', changelog.ChangelogViewSet, basename='changelog')

urlpatterns = [
    url(r'^project/(?P<project>[\w-]{0,50})/', include(project_bound_router.urls)),
    url(r'^', include(default_router.urls)),
    url(r'^', include(tle_router.urls)),
    url(r'^failures/$', intermittents_view.Failures.as_view(), name='failures'),
    url(r'^failuresbybug/$', intermittents_view.FailuresByBug.as_view(), name='failures-by-bug'),
    url(r'^failurecount/$', intermittents_view.FailureCount.as_view(), name='failure-count'),
    url(
        r'^performance/summary/$',
        performance_data.PerformanceSummary.as_view(),
        name='performance-summary',
    ),
    url(r'^csp-report/$', csp_report.csp_report_collector, name='csp-report'),
]
