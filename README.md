# Copyright Violation

A fullstack app for committing copyright violations, built with a
Django GraphQL backend and a React interface. Pull songs from YouTube, split
them into stems with [Demucs](https://github.com/facebookresearch/demucs) and
play each track in the browser. This project is obviously a joke—use only
content you are legally allowed to process.

## Features

* Download audio or video via `yt-dlp`
* Files are saved with clean, unique names based on the title
* Separate audio into stems such as vocals, drums and bass
* Automatically separates all stems for each track
* Responsive React interface with a simple player for the isolated stems

## Requirements

* Python 3.11+
* Node.js 18+
* (optional) NVIDIA GPU for faster Demucs separation

## Setup

On Windows you can run `start-copyright.ps1` which creates a virtual
environment, installs dependencies and starts the development servers. The script
attempts to detect a GPU and will install CUDA-enabled PyTorch if available.
Set `FORCE_CUDA=1` or `FORCE_CPU=1` to override the detection.

Manual setup works on any platform:

```bash
python -m venv venv
source venv/bin/activate    # .\\venv\\Scripts\\Activate.ps1 on Windows
pip install -r requirements.txt
cd frontend && npm install
```

## Running

Start the backend server:

```bash
python manage.py runserver
```

In a second terminal start the frontend:

```bash
npm run dev -- --host
```

By default the backend listens on `http://localhost:8000` and the frontend on
`http://localhost:5173`.

### Download workflow

When downloading audio or video the frontend first subscribes to a progress
stream. The backend runs `yt-dlp` once and writes the final file using a unique
name derived from the title. After the stream completes the frontend calls the
matching mutation which simply returns the download URL instead of running
`yt-dlp` again. This prevents duplicate downloads and leftover temporary files.

## GPU acceleration

Install the CUDA build of PyTorch to use your GPU:

```bash
pip install --force-reinstall torch torchvision torchaudio \
  --index-url https://download.pytorch.org/whl/cu118
```

Verify that PyTorch can access the GPU:

```bash
python - <<'PY'
import torch
print("CUDA available:", torch.cuda.is_available())
print("CUDA version:", torch.version.cuda)
PY
```

If this prints `CUDA available: True` the separation process will run on the GPU.
If not, ensure `nvidia-smi` is installed and in your `PATH` or force the CUDA
build with `FORCE_CUDA=1` when running the startup script.

## Avoid YouTube rate limits

Downloading many tracks quickly may trigger temporary rate limits on YouTube.
Set the `YT_DLP_SLEEP` environment variable to wait between requests:

```bash
export YT_DLP_SLEEP=2
```

The value is the number of seconds to sleep before each `yt-dlp` request.
