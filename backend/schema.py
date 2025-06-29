import asyncio
import subprocess
import json
import urllib.parse
from pathlib import Path
import sys
import shutil
import secrets
import os
import platform

from ariadne import (
    make_executable_schema,
    QueryType,
    MutationType,
    SubscriptionType,
    gql,
    upload_scalar,
)
import torch
from django.conf import settings

# Ensure MEDIA_ROOT exists
MEDIA_DIR = Path(settings.MEDIA_ROOT)
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

type_defs = gql(
    """
  scalar Upload

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
    path: String!
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
    uploadAudio(file: Upload!, title: String): DownloadResponse!
    separateStems(
      filename: String!,
      model: String!,
      stems: [String!]!
    ): SeparationResponse!
    deleteDownload(filename: String!): Boolean!
    openStemsFolder(filename: String!): Boolean!
  }
  type Subscription {
    downloadAudioProgress(url: String!): String!
    downloadVideoProgress(url: String!): String!
    separateStemsProgress(
      filename: String!,
      model: String!,
      stems: [String!]!
    ): String!
  }
"""
)

query = QueryType()
mutation = MutationType()
subscription = SubscriptionType()


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
        "thumbnail": info.get("thumbnail"),
    }
    meta_path.write_text(json.dumps(meta))


def read_metadata(vid: str):
    meta_path = MEDIA_DIR / f"{vid}.json"
    if not meta_path.exists():
        return {"title": vid, "thumbnail": None}
    return json.loads(meta_path.read_text())


def open_folder(path: Path):
    try:
        if sys.platform.startswith("win"):
            os.startfile(path)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])
        return True
    except Exception:
        return False


@mutation.field("openStemsFolder")
def resolve_open_stems_folder(_, __, filename: str):
    vid = Path(filename).stem
    stems_dir = MEDIA_DIR / vid / "stems"
    htdemucs_path = stems_dir / "htdemucs_6s"
    if htdemucs_path.exists():
        return open_folder(htdemucs_path)
    if stems_dir.exists():
        return open_folder(stems_dir)
    return False


async def stream_process(cmd: list[str]):
    """Yield output lines from a subprocess as they are produced.

    On platforms where ``asyncio`` cannot create subprocess transports (e.g.
    some Windows event loops), fall back to a synchronous ``subprocess``
    running in the current thread and yield its output asynchronously.
    """
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        assert proc.stdout is not None
        while True:
            line = await proc.stdout.readline()
            if not line:
                break
            yield line.decode()
        await proc.wait()
    except NotImplementedError:
        with subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        ) as proc:
            assert proc.stdout is not None
            for line in proc.stdout:
                yield line
                await asyncio.sleep(0)
            proc.wait()


@query.field("downloads")
def resolve_downloads(_, __):
    items = []
    files = [f for f in MEDIA_DIR.iterdir() if f.is_file()]
    files.sort(key=lambda p: p.stat().st_mtime)
    audio_exts = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}
    for f in files:
        ext = f.suffix.lower()
        if ext in audio_exts:
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
                for stem_file in sorted(stems_dir.rglob("*.mp3")):
                    stems_list.append(
                        {
                            "name": stem_file.stem,
                            "url": build_media_url(
                                f"{vid}/stems/"
                                f"{stem_file.relative_to(stems_dir)}"
                            ),
                            "path": str(stem_file.resolve()),
                        }
                    )

        items.append(
            {
                "filename": f.name,
                "url": rel_url,
                "type": typ,
                "title": meta["title"],
                "thumbnail": meta.get("thumbnail"),
                "stems": stems_list,
            }
        )
    return items




@mutation.field("downloadAudio")
def resolve_download_audio(_, __, url: str):
    vid = extract_video_id(url)
    out_filename = f"{vid}.mp3"
    out_path = MEDIA_DIR / out_filename

    # combined metadata fetch & download
    proc = subprocess.run(
        [
            "yt-dlp",
            "--print-json",
            "--newline",
            "-x",
            "--audio-format",
            "mp3",
            "-o",
            str(out_path),
            url,
        ],
        capture_output=True,
        text=True,
    )
    info_json = None
    for line in proc.stdout.splitlines():
        if line.strip().startswith("{"):
            info_json = line
            break
    if info_json:
        try:
            write_metadata(vid, json.loads(info_json))
        except Exception:
            write_metadata(vid, {"title": vid, "thumbnail": None})
    else:
        write_metadata(vid, {"title": vid, "thumbnail": None})
    message = proc.stdout + proc.stderr
    success = proc.returncode == 0
    rel_url = build_media_url(out_filename) if success else None

    return {"success": success, "message": message, "downloadUrl": rel_url}


@mutation.field("downloadVideo")
def resolve_download_video(_, __, url: str):
    vid = extract_video_id(url)
    out_filename = f"{vid}.mp4"
    out_path = MEDIA_DIR / out_filename

    # combined metadata fetch & download
    proc = subprocess.run(
        [
            "yt-dlp",
            "--print-json",
            "--newline",
            "-f",
            "bestvideo+bestaudio",
            "--merge-output-format",
            "mp4",
            "-o",
            str(out_path),
            url,
        ],
        capture_output=True,
        text=True,
    )
    info_json = None
    for line in proc.stdout.splitlines():
        if line.strip().startswith("{"):
            info_json = line
            break
    if info_json:
        try:
            write_metadata(vid, json.loads(info_json))
        except Exception:
            write_metadata(vid, {"title": vid, "thumbnail": None})
    else:
        write_metadata(vid, {"title": vid, "thumbnail": None})
    message = proc.stdout + proc.stderr
    success = proc.returncode == 0
    rel_url = build_media_url(out_filename) if success else None

    return {"success": success, "message": message, "downloadUrl": rel_url}


@mutation.field("uploadAudio")
def resolve_upload_audio(_, __, file, title: str | None = None):
    ext = Path(file.name).suffix or ".mp3"
    vid = secrets.token_hex(8)
    out_filename = f"{vid}{ext}"
    out_path = MEDIA_DIR / out_filename
    with open(out_path, "wb") as dst:
        for chunk in file.chunks():
            dst.write(chunk)
    write_metadata(vid, {"title": title or file.name, "thumbnail": None})
    rel_url = build_media_url(out_filename)
    return {"success": True, "message": "", "downloadUrl": rel_url}


@mutation.field("separateStems")
def resolve_separate_stems(_, __, filename: str, model: str, stems: list[str]):
    src_path = MEDIA_DIR / filename
    vid = Path(filename).stem
    out_dir = MEDIA_DIR / vid / "stems"
    out_dir.mkdir(parents=True, exist_ok=True)

    cuda_available = torch.cuda.is_available()
    device = "cuda" if cuda_available else "cpu"
    if not cuda_available:
        if torch.version.cuda is None:
            reason = "PyTorch was installed without CUDA support."
        else:
            reason = "CUDA runtime not available."
    else:
        reason = ""
    device_flag = f"--device={device}"
    cmd = [
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
        device_flag,
    ]
    if stems:
        stems_lower = [s.lower() for s in stems]
        unique = set(stems_lower)
        if unique == {"vocals", "accompaniment"}:
            cmd += ["--two-stems", "vocals"]
        elif len(unique) == 1:
            cmd += ["--stem", next(iter(unique))]
    cmd.append(str(src_path))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    extra = f"\n{reason}" if reason else ""
    logs = f"Using device: {device}{extra}\n" + proc.stdout + proc.stderr
    success = proc.returncode == 0
    return {"success": success, "logs": logs}


@mutation.field("deleteDownload")
def resolve_delete_download(_, __, filename: str):
    target = MEDIA_DIR / filename
    vid = Path(filename).stem
    meta_path = MEDIA_DIR / f"{vid}.json"
    stems_dir = MEDIA_DIR / vid
    try:
        if target.exists():
            target.unlink()
        if meta_path.exists():
            meta_path.unlink()
        if stems_dir.exists():
            shutil.rmtree(stems_dir)
        return True
    except Exception:
        return False


@subscription.source("downloadAudioProgress")
async def stream_download_audio(_, info, url: str):
    vid = extract_video_id(url)
    out_filename = f"{vid}.mp3"
    out_path = MEDIA_DIR / out_filename
    cmd = [
        "yt-dlp",
        "--print-json",
        "--newline",
        "-x",
        "--audio-format",
        "mp3",
        "-o",
        str(out_path),
        url,
    ]
    seen_info = False
    async for line in stream_process(cmd):
        if not seen_info and line.strip().startswith("{"):
            try:
                write_metadata(vid, json.loads(line))
                seen_info = True
            except json.JSONDecodeError:
                pass
            continue
        yield line


@subscription.field("downloadAudioProgress")
def resolve_download_audio_progress(line, info, url: str):
    return line


@subscription.source("downloadVideoProgress")
async def stream_download_video(_, info, url: str):
    vid = extract_video_id(url)
    out_filename = f"{vid}.mp4"
    out_path = MEDIA_DIR / out_filename
    cmd = [
        "yt-dlp",
        "--print-json",
        "--newline",
        "-f",
        "bestvideo+bestaudio",
        "--merge-output-format",
        "mp4",
        "-o",
        str(out_path),
        url,
    ]
    seen_info = False
    async for line in stream_process(cmd):
        if not seen_info and line.strip().startswith("{"):
            try:
                write_metadata(vid, json.loads(line))
                seen_info = True
            except json.JSONDecodeError:
                pass
            continue
        yield line


@subscription.field("downloadVideoProgress")
def resolve_download_video_progress(line, info, url: str):
    return line


@subscription.source("separateStemsProgress")
async def stream_separate_stems(
    _, info, filename: str, model: str, stems: list[str]
):
    src_path = MEDIA_DIR / filename
    vid = Path(filename).stem
    out_dir = MEDIA_DIR / vid / "stems"
    out_dir.mkdir(parents=True, exist_ok=True)

    cuda_available = torch.cuda.is_available()
    device = "cuda" if cuda_available else "cpu"
    if not cuda_available:
        if torch.version.cuda is None:
            reason = "PyTorch was installed without CUDA support."
        else:
            reason = "CUDA runtime not available."
    else:
        reason = ""
    device_flag = f"--device={device}"

    intro = f"Using device: {device}\n"
    if reason:
        intro += reason + "\n"
    yield intro

    cmd = [
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
        device_flag,
    ]
    if stems:
        stems_lower = [s.lower() for s in stems]
        unique = set(stems_lower)
        if unique == {"vocals", "accompaniment"}:
            cmd += ["--two-stems", "vocals"]
        elif len(unique) == 1:
            cmd += ["--stem", next(iter(unique))]
    cmd.append(str(src_path))
    async for line in stream_process(cmd):
        yield line


@subscription.field("separateStemsProgress")
def resolve_separate_stems_progress(
    line, info, filename: str, model: str, stems: list[str]
):
    return line


schema = make_executable_schema(
    type_defs, query, mutation, subscription, upload_scalar
)
