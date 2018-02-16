from django.conf import settings
from django.conf.urls import (include,
                              url)
from django.views.decorators.csrf import csrf_exempt
from rest_framework.documentation import include_docs_urls

from treeherder.webapp.api import urls as api_urls

urlpatterns = [
    url(r'^api/', include(api_urls)),
    url(r'^docs/', include_docs_urls(title='REST API Docs')),
]

if settings.DEBUG:
    import debug_toolbar
    urlpatterns += [
        url(r'^__debug__/', include(debug_toolbar.urls)),
    ]

if settings.GRAPHQL:
    from graphene_django.views import GraphQLView
    from treeherder.webapp.graphql.schema import schema
    urlpatterns += [
        url(r'^graphql$',
            csrf_exempt(GraphQLView.as_view(graphiql=True, schema=schema)),
            name='graphql'),
    ]
