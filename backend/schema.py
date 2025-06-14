import subprocess
import json
import urllib.parse
from pathlib import Path
import sys

from ariadne import make_executable_schema, QueryType, MutationType, gql
import torch
from django.conf import settings

# Ensure MEDIA_ROOT exists
MEDIA_DIR = Path(settings.MEDIA_ROOT)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

type_defs = gql("""
  type DownloadResponse {
    success: Boolean!
    message: String
    downloadUrl: String
  }

  type DownloadedFile {
    filename: String!
    url: String!      # e.g. "/media/IEc30xnkqQ8.mp4"
    type: String!
    title: String!
    thumbnail: String
    stems: [Stem!]!
  }

  type Stem {
    name: String!
    url: String!
  }

  type SeparationResponse {
    success: Boolean!
    logs: String
  }

  type Query {
    downloads: [DownloadedFile!]!
  }

  type Mutation {
    downloadAudio(url: String!): DownloadResponse!
    downloadVideo(url: String!): DownloadResponse!
    separateStems(filename: String!, model: String!): SeparationResponse!
  }
""")

query    = QueryType()
mutation = MutationType()


def extract_video_id(url: str) -> str:
    parsed = urllib.parse.urlparse(url)
    qs = urllib.parse.parse_qs(parsed.query)
    if "v" in qs:
        return qs["v"][0]
    return parsed.path.rstrip("/").split("/")[-1]


def build_media_url(filename: str) -> str:
    base = settings.MEDIA_URL
    if not base.endswith("/"):
        base += "/"
    return f"{base}{filename}"


def write_metadata(vid: str, info: dict):
    meta_path = MEDIA_DIR / f"{vid}.json"
    meta = {
        "title": info.get("title", vid),
        "thumbnail": info.get("thumbnail")
    }
    meta_path.write_text(json.dumps(meta))


def read_metadata(vid: str):
    meta_path = MEDIA_DIR / f"{vid}.json"
    if not meta_path.exists():
        return {"title": vid, "thumbnail": None}
    return json.loads(meta_path.read_text())


@query.field("downloads")
def resolve_downloads(_, __):
    items = []
    for f in sorted(MEDIA_DIR.iterdir()):
        if not f.is_file():
            continue
        ext = f.suffix.lower()
        if ext == ".mp3":
            typ = "audio"
        elif ext == ".mp4":
            typ = "video"
        else:
            continue

        vid = f.stem
        meta = read_metadata(vid)
        rel_url = build_media_url(f.name)

        stems_list = []
        if typ == "audio":
            stems_dir = MEDIA_DIR / vid / "stems"
            if stems_dir.exists():
                for stem_file in sorted(stems_dir.glob("*.mp3")):
                    stems_list.append({
                        "name": stem_file.stem,
                        "url": build_media_url(f"{vid}/stems/{stem_file.name}"),
                    })

        items.append({
            "filename":  f.name,
            "url":       rel_url,
            "type":      typ,
            "title":     meta["title"],
            "thumbnail": meta.get("thumbnail"),
            "stems":     stems_list,
        })
    return items


@mutation.field("downloadAudio")
def resolve_download_audio(_, __, url: str):
    vid = extract_video_id(url)
    out_filename = f"{vid}.mp3"
    out_path = MEDIA_DIR / out_filename

    # fetch & save metadata
    try:
        raw = subprocess.run(
            ["yt-dlp", "--dump-json", url],
            capture_output=True, text=True
        )
        write_metadata(vid, json.loads(raw.stdout))
    except Exception:
        write_metadata(vid, {"title": vid, "thumbnail": None})

    # perform download
    proc = subprocess.run(
        ["yt-dlp", "-x", "--audio-format", "mp3", "-o", str(out_path), url],
        capture_output=True, text=True
    )
    message = proc.stdout + proc.stderr
    success = proc.returncode == 0
    rel_url = build_media_url(out_filename) if success else None

    return {"success": success, "message": message, "downloadUrl": rel_url}


@mutation.field("downloadVideo")
def resolve_download_video(_, __, url: str):
    vid = extract_video_id(url)
    out_filename = f"{vid}.mp4"
    out_path = MEDIA_DIR / out_filename

    # fetch & save metadata
    try:
        raw = subprocess.run(
            ["yt-dlp", "--dump-json", url],
            capture_output=True, text=True
        )
        write_metadata(vid, json.loads(raw.stdout))
    except Exception:
        write_metadata(vid, {"title": vid, "thumbnail": None})

    # perform download
    proc = subprocess.run(
        ["yt-dlp", "-f", "bestvideo+bestaudio", "--merge-output-format", "mp4",
         "-o", str(out_path), url],
        capture_output=True, text=True
    )
    message = proc.stdout + proc.stderr
    success = proc.returncode == 0
    rel_url = build_media_url(out_filename) if success else None

    return {"success": success, "message": message, "downloadUrl": rel_url}


@mutation.field("separateStems")
def resolve_separate_stems(_, __, filename: str, model: str):
    src_path = MEDIA_DIR / filename
    vid = Path(filename).stem
    out_dir = MEDIA_DIR / vid / "stems"
    out_dir.mkdir(parents=True, exist_ok=True)

    gpu_flag = "--gpu" if torch.cuda.is_available() else "--cpu"
    proc = subprocess.run(
        [
            sys.executable,
            "-m",
            "demucs.separate",
            "-n",
            model,
            "--out",
            str(out_dir),
            "--filename",
            "{stem}.{ext}",
            "--mp3",
            gpu_flag,
            str(src_path),
        ],
        capture_output=True,
        text=True,
    )
    logs = proc.stdout + proc.stderr
    success = proc.returncode == 0
    return {"success": success, "logs": logs}


schema = make_executable_schema(type_defs, query, mutation)
