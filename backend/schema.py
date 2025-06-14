import asyncio
import datetime
import json
import subprocess
from typing import Dict, Tuple

from ariadne import make_executable_schema, QueryType, SubscriptionType, gql

# ──────────────────────────────────────────────────────────────────────────────
# 1️⃣ Define your GraphQL schema (SDL)
# ──────────────────────────────────────────────────────────────────────────────
type_defs = gql("""
  type SearchResult {
    id: ID!
    title: String!
    url: String!
    thumbnail: String
  }

  type Query {
    search(query: String!, limit: Int = 20): [SearchResult!]!
  }

  type Subscription {
    time: String!
    searchStream(query: String!, limit: Int = 20): SearchResult!
  }
""")

# ──────────────────────────────────────────────────────────────────────────────
# 2️⃣ Map resolvers for Query
# ──────────────────────────────────────────────────────────────────────────────
query = QueryType()

# Simple in-memory cache for search results
SEARCH_CACHE: Dict[Tuple[str, str, int], Tuple[float, list]] = {}
CACHE_TTL = 300  # seconds

@query.field("search")
async def resolve_search(obj, info, query, limit):
    # Debug to confirm invocation
    print(f">>> resolve_search called: query={query!r}, limit={limit}")

    key = ("youtube", query, limit)
    now = datetime.datetime.utcnow().timestamp()
    cached = SEARCH_CACHE.get(key)
    if cached and now - cached[0] < CACHE_TTL:
        print("⚡ Returning cached results")
        return cached[1]

    # Build the yt-dlp prefix for YouTube only
    prefix = f"ytsearch{limit}:{query}"

    # Offload subprocess.run to a thread pool
    def run_yt_dlp():
        try:
            result = subprocess.run(
                ["yt-dlp", "--dump-json", prefix],
                capture_output=True,
                text=True,
                check=True,
            )
            return result.stdout
        except subprocess.CalledProcessError as e:
            print(f"yt-dlp failed: {e.stderr}")
            return ""

    stdout = await asyncio.get_event_loop().run_in_executor(None, run_yt_dlp)
    if not stdout:
        return []

    # Parse lines into a Python list
    items = []
    for line in stdout.splitlines():
        info = json.loads(line)
        items.append({
            "id":        info.get("id") or info.get("url"),
            "title":     info.get("title", "<no title>"),
            "url":       info.get("webpage_url") or info.get("url"),
            "thumbnail": info.get("thumbnail"),
        })
    # Debug to confirm return type
    print("⏹️ Returning items:", type(items), "length=", len(items))
    SEARCH_CACHE[key] = (now, items)
    return items

# ──────────────────────────────────────────────────────────────────────────────
# 3️⃣ Map resolvers for Subscription
# ──────────────────────────────────────────────────────────────────────────────
subscription = SubscriptionType()

@subscription.source("searchStream")
async def search_stream_source(obj, info, query, limit):
    prefix = f"ytsearch{limit}:{query}"
    process = await asyncio.create_subprocess_exec(
        "yt-dlp",
        "--dump-json",
        prefix,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    assert process.stdout
    async for raw_line in process.stdout:
        if not raw_line:
            break
        line = raw_line.decode()
        data = json.loads(line)
        yield {
            "id": data.get("id") or data.get("url"),
            "title": data.get("title", "<no title>"),
            "url": data.get("webpage_url") or data.get("url"),
            "thumbnail": data.get("thumbnail"),
        }
    await process.wait()

@subscription.field("searchStream")
def search_stream_resolver(result, info, **kwargs):
    return result

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
