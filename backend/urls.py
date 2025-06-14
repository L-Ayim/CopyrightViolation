# backend/urls.py

from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

from ariadne_django.views import GraphQLAsyncView
from .schema import schema

urlpatterns = [
    # Admin UI
    path("admin/", admin.site.urls),

    # GraphQL HTTP endpoint (queries & mutations)
    path(
        "graphql/",
        GraphQLAsyncView.as_view(schema=schema),
        name="graphql",
    ),
]

# In DEBUG mode, serve media files through Django
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
