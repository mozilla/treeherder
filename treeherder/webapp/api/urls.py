from django.conf.urls import patterns, include, url
from treeherder.webapp.api import (refdata, objectstore, jobs, resultset,
                                   artifact, note, revision, bug)

from rest_framework import routers

# router for views that are bound to a project
# i.e. all those views that don't involve reference data
project_bound_router = routers.DefaultRouter()
project_bound_router.register(
    r'objectstore',
    objectstore.ObjectstoreViewSet,
    base_name='objectstore',
)
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
    r'note',
    note.NoteViewSet,
    base_name='note',
)

project_bound_router.register(
    r'revision-lookup',
    revision.RevisionLookupSetViewSet,
    base_name='revision-lookup',
)

project_bound_router.register(
    r'bug-job-map',
    bug.BugJobMapViewSet,
    base_name='bug-job-map',
)

# this is the default router for plain restful endpoints

# refdata endpoints:
default_router = routers.DefaultRouter()
default_router.register(r'product', refdata.ProductViewSet)
default_router.register(r'machine', refdata.MachineViewSet)
default_router.register(r'machinenote', refdata.MachineNoteViewSet)
default_router.register(r'machineplatform', refdata.MachinePlatformViewSet)
default_router.register(r'buildplatform', refdata.BuildPlatformViewSet)
default_router.register(r'jobgroup', refdata.JobGroupViewSet)
default_router.register(r'jobtype', refdata.JobTypeViewSet)
default_router.register(r'repository', refdata.RepositoryViewSet)
default_router.register(r'repositoryversion', refdata.RepositoryVersionViewSet)
default_router.register(r'option', refdata.OptionViewSet)
default_router.register(r'optioncollection', refdata.OptionCollectionViewSet)
default_router.register(r'bugscache', refdata.BugscacheViewSet)
default_router.register(r'failureclassification', refdata.FailureClassificationViewSet)
default_router.register(r'user', refdata.UserViewSet)
default_router.register(r'exclusion-profile', refdata.ExclusionProfileViewSet)
default_router.register(r'job-filter', refdata.JobFilterViewSet)


urlpatterns = patterns(
    '',
    url(r'^project/(?P<project>[\w-]{0,50})/',
        include(project_bound_router.urls)),
    url(r'^',
        include(default_router.urls)),
)
