# backend/asgi.py

import os
import sys
import asyncio

# 1) Tell Django where to find settings **before** any Django imports
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

# 2) On Windows, use ProactorEventLoop so subprocesses work
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import django
django.setup()

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import re_path

from ariadne.asgi import GraphQL
from ariadne.asgi.handlers import GraphQLTransportWSHandler

# 3) Now it’s safe to import your schema (which uses settings)
from .schema import schema

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
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
