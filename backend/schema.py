# backend/schema.py

import sys
import os
import re
import json
import shutil
import subprocess
import urllib.parse
from pathlib import Path

import torch
from ariadne import (
    QueryType,
    MutationType,
    make_executable_schema,
    gql,
    upload_scalar,
)
from django.conf import settings

# ─── Constants & Helpers ──────────────────────────────────────────────────────

MEDIA_DIR = Path(settings.MEDIA_ROOT)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
MEDIA_URL = settings.MEDIA_URL.rstrip("/") + "/"

def extract_video_id(url: str) -> str:
    p = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(p.query)
    return qs.get("v", [Path(p.path).stem])[0]

def sanitize_filename(name: str) -> str:
    base = re.sub(r"[^A-Za-z0-9._-]+", "_", Path(name).stem)
    return base.strip("._") or "file"

def unique_filename(title: str, ext: str) -> tuple[str, str]:
    base = sanitize_filename(title)
    cand = base
    i = 1
    # avoid collisions with both .mp3 and .json files
    while (MEDIA_DIR / f"{cand}{ext}").exists() or (MEDIA_DIR / f"{cand}.json").exists():
        cand = f"{base}_{i}"
        i += 1
    return f"{cand}{ext}", cand

def write_metadata(vid: str, info: dict):
    (MEDIA_DIR / f"{vid}.json").write_text(json.dumps({
        "title":     info.get("title", vid),
        "thumbnail": info.get("thumbnail"),
    }))

def read_metadata(vid: str) -> dict:
    p = MEDIA_DIR / f"{vid}.json"
    if p.exists():
        return json.loads(p.read_text())
    return {"title": vid, "thumbnail": None}

def list_stems_for(vid: str) -> list[dict]:
    stems_dir = MEDIA_DIR / vid / "stems"
    out = []
    if stems_dir.exists():
        for f in sorted(stems_dir.rglob("*.mp3")):
            rel = f.relative_to(stems_dir).as_posix()
            out.append({
                "name": Path(f).stem,
                "url":   MEDIA_URL + f"{vid}/stems/{rel}",
                "path":  str(f.resolve()),
            })
    return out

# ─── GraphQL Schema ───────────────────────────────────────────────────────────

type_defs = gql("""
  scalar Upload

  type Stem {
    name: String!
    url: String!
    path: String!
  }

  type DownloadedAudio {
    filename: String!
    url: String!
    title: String!
    thumbnail: String
    stems: [Stem!]!
  }

  type DownloadResponse {
    success: Boolean!
    message: String
    downloadUrl: String
  }

  type Query {
    downloads: [DownloadedAudio!]!
  }

  type Mutation {
    downloadAudio(url: String!): DownloadResponse!
    uploadAudio(file: Upload!, title: String): DownloadResponse!
    deleteDownload(filename: String!): Boolean!
  }
""")

query = QueryType()
mutation = MutationType()

# ─── Query Resolvers ───────────────────────────────────────────────────────────

@query.field("downloads")
def resolve_downloads(*_):
    items = []
    for f in sorted(MEDIA_DIR.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if f.suffix.lower() != ".mp3":
            continue
        vid = f.stem
        meta = read_metadata(vid)
        items.append({
            "filename":  f.name,
            "url":       MEDIA_URL + f.name,
            "title":     meta["title"],
            "thumbnail": meta.get("thumbnail"),
            "stems":     list_stems_for(vid),
        })
    return items

# ─── Mutation Resolvers ────────────────────────────────────────────────────────

@mutation.field("downloadAudio")
def resolve_download_audio(*_, url: str):
    vid = extract_video_id(url)

    # 1) Fetch JSON metadata
    dump = subprocess.run(
        ["yt-dlp", "--dump-json", url],
        capture_output=True, text=True
    )
    if dump.returncode != 0:
        return {
            "success": False,
            "message": dump.stderr or "Metadata fetch failed",
            "downloadUrl": None
        }
    try:
        info = json.loads(dump.stdout)
    except json.JSONDecodeError:
        return {
            "success": False,
            "message": "Unable to parse metadata",
            "downloadUrl": None
        }

    # 2) Determine unique output filename
    ext = ".mp3"
    out_fn, base = unique_filename(info.get("title", vid), ext)
    out_path = MEDIA_DIR / out_fn

    # 3) Save metadata for title & thumbnail
    write_metadata(base, {
        "title": info.get("title", vid),
        "thumbnail": info.get("thumbnail"),
    })

    # 4) Download MP3
    dl = subprocess.run(
        ["yt-dlp", "-x", "--audio-format", "mp3", "-o", str(out_path), url],
        capture_output=True, text=True
    )
    if dl.returncode != 0:
        return {
            "success": False,
            "message": dl.stderr or "Download failed",
            "downloadUrl": None
        }

    # 5) Separate stems with Demucs
    stems_dir = MEDIA_DIR / base / "stems"
    stems_dir.mkdir(parents=True, exist_ok=True)
    sep = subprocess.run(
        [
            sys.executable, "-m", "demucs.separate",
            "-n", "htdemucs_6s",
            "--out", str(stems_dir),
            "--filename", "{stem}.{ext}", "--mp3",
            str(out_path),
        ],
        capture_output=True, text=True
    )
    if sep.returncode != 0:
        return {
            "success": False,
            "message": sep.stderr or "Separation failed",
            "downloadUrl": MEDIA_URL + out_fn
        }

    return {
        "success": True,
        "message": "Download & separation complete",
        "downloadUrl": MEDIA_URL + out_fn
    }

@mutation.field("uploadAudio")
def resolve_upload_audio(*_, file, title=None):
    ext = Path(file.name).suffix or ".mp3"
    out_fn, base = unique_filename(title or file.name, ext)
    with open(MEDIA_DIR / out_fn, "wb") as dst:
        for chunk in file.chunks():
            dst.write(chunk)
    write_metadata(base, {
        "title": title or file.name,
        "thumbnail": None
    })
    return {
        "success": True,
        "message": "Upload complete",
        "downloadUrl": MEDIA_URL + out_fn
    }

@mutation.field("deleteDownload")
def resolve_delete_download(*_, filename: str):
    try:
        f = MEDIA_DIR / filename
        vid = f.stem
        f.unlink()
        shutil.rmtree(MEDIA_DIR / vid, ignore_errors=True)
        (MEDIA_DIR / f"{vid}.json").unlink(missing_ok=True)
        return True
    except:
        return False

# ─── Build & export schema ─────────────────────────────────────────────────────

schema = make_executable_schema(type_defs, query, mutation, upload_scalar)
