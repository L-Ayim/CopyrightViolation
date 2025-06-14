# backend/asgi.py

import os
import django

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import re_path

from ariadne.asgi import GraphQL
from ariadne.asgi.handlers import GraphQLTransportWSHandler

from .schema import schema

# Tell Django where to find settings and bootstrap
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")
django.setup()

application = ProtocolTypeRouter({
    # HTTP requests → Django (which uses backend/urls.py → GraphQLView)
    "http": get_asgi_application(),

    # WebSocket requests → Ariadne for subscriptions
    "websocket": AuthMiddlewareStack(
        URLRouter([
            re_path(
                r"^graphql/?$",
                GraphQL(
                    schema,
                    debug=True,
                    websocket_handler=GraphQLTransportWSHandler(),
                ),
            ),
        ])
    ),
})
