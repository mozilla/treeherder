from rest_framework import routers

from django_ci.api import ResultSetViewSet, RevisionViewSet


router = routers.DefaultRouter()
router.register(r'result_set', ResultSetViewSet)
router.register(r'revision', RevisionViewSet)
urlpatterns = router.urls
