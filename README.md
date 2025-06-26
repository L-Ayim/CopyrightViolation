# Copyright Violation

A fullstack app for committing copyright violations, built with a
Django GraphQL backend and a React interface. Pull songs from YouTube, split
them into stems with [Demucs](https://github.com/facebookresearch/demucs) and
play each track in the browser. This project is obviously a joke—use only
content you are legally allowed to process.

## Features

* Download audio or video via `yt-dlp`
* Separate audio into stems such as vocals, drums and bass
* Automatically separates all stems for each track
* Responsive React interface with a simple player for the isolated stems
* Drag stem buttons to a DAW or the desktop to download automatically

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
