from django.conf.urls import patterns, include, url
from django.views.generic import RedirectView
from django.contrib import admin

from .api import urls as api_urls

admin.autodiscover()

urlpatterns = patterns('',
    url(r'^api/', include(api_urls)),
    url(r'^browserid/', include('django_browserid.urls')),
    url(r'^admin/', include(admin.site.urls)),
    url(r'^docs/', include('rest_framework_swagger.urls')),
    # by default redirect all request on / to /ui/
    url(r'^$', RedirectView.as_view(url='/ui/'))
)
