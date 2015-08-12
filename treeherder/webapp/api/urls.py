# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at http://mozilla.org/MPL/2.0/.

from django.conf.urls import patterns, include, url
from treeherder.webapp.api import (refdata, jobs, resultset,
                                   artifact, note, bug, logslice,
                                   performance_data, job_log_url,
                                   performance_artifact, projects)

from rest_framework import routers

# router for views that are bound to a project
# i.e. all those views that don't involve reference data
project_bound_router = routers.SimpleRouter()

project_bound_router.register(
    r'jobs',
    jobs.JobsViewSet,
    base_name='jobs',
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
    r'performance_artifact',
    performance_artifact.PerformanceArtifactViewSet,
    base_name='performance_artifact',
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
    r'performance/datum',
    performance_data.PerformanceDatumViewSet,
    base_name='performance-datum')

project_bound_router.register(
    r'performance/signatures',
    performance_data.PerformanceSignatureViewSet,
    base_name='performance-signatures')

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

urlpatterns = patterns(
    '',
    url(r'^project/(?P<project>[\w-]{0,50})/',
        include(project_bound_router.urls)),
    url(r'^project/(?P<project>[\w-]{0,50})/?$',
        projects.project_info, name='project_info'),
    url(r'^',
        include(default_router.urls)),
)
