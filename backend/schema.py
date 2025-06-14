import asyncio
import datetime

from ariadne import QueryType, SubscriptionType, gql, make_executable_schema

# ──────────────────────────────────────────────────────────────────────────────
# 1️⃣ Define your GraphQL schema (SDL)
# ──────────────────────────────────────────────────────────────────────────────

# Only keep a minimal placeholder query and the time subscription

type_defs = gql(
    """
  type Query {
    _: Boolean
  }

  type Subscription {
    time: String!
  }
"""
)

# ──────────────────────────────────────────────────────────────────────────────
# 2️⃣ Map resolvers for Query
# ──────────────────────────────────────────────────────────────────────────────

query = QueryType()

@query.field("_")
def resolve_placeholder(*_):
    return True

# ──────────────────────────────────────────────────────────────────────────────
# 3️⃣ Map resolvers for Subscription
# ──────────────────────────────────────────────────────────────────────────────

subscription = SubscriptionType()

@subscription.source("time")
async def time_source(obj, info):
    while True:
        yield datetime.datetime.utcnow().isoformat() + "Z"
        await asyncio.sleep(1)

@subscription.field("time")
def time_resolver(timestamp, info):
    return timestamp

# ──────────────────────────────────────────────────────────────────────────────
# 4️⃣ Build and export the executable schema
# ──────────────────────────────────────────────────────────────────────────────

schema = make_executable_schema(type_defs, query, subscription)
