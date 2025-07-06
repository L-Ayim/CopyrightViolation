# Copyright Violation

A minimal example application for downloading YouTube audio and separating tracks into stems. The backend is built with Django and GraphQL, while the frontend uses React. Audio is downloaded with `yt-dlp` and separated with [Demucs](https://github.com/facebookresearch/demucs). Only process content that you have the rights to use.

## Features
- Download audio or video via `yt-dlp`
- Files are saved with unique, sanitized names
- Automatically separate vocals, drums, bass and other stems
- Simple React interface for playing each stem

## Requirements
- Python 3.11+
- Node.js 18+
- (optional) NVIDIA GPU for faster Demucs processing

## Setup
### Quick start on Windows
Run `start-copyright.ps1`. It creates a virtual environment, installs dependencies and starts both the backend and frontend. The script detects a GPU and installs the appropriate PyTorch build. You can override detection with `FORCE_CUDA=1` or `FORCE_CPU=1`.

### Manual setup
```bash
python -m venv venv
source venv/bin/activate    # .\\venv\\Scripts\\Activate.ps1 on Windows
pip install -r requirements.txt
cd frontend && npm install
```

## Running
Start the backend:
```bash
python manage.py runserver
```

Then start the frontend in another terminal:
```bash
npm run dev -- --host
```

The backend listens on `http://localhost:8000` and the frontend on `http://localhost:5173`.

## GPU acceleration
Install the CUDA build of PyTorch to use your GPU:
```bash
pip install --force-reinstall torch torchvision torchaudio \
  --index-url https://download.pytorch.org/whl/cu118
```
Check that PyTorch can access the GPU:
```bash
python - <<'PY'
import torch
print("CUDA available:", torch.cuda.is_available())
print("CUDA version:", torch.version.cuda)
PY
```

## Avoid YouTube rate limits
Downloading many tracks quickly may trigger temporary rate limits on YouTube. Set the `YT_DLP_SLEEP` environment variable to wait between requests:
```bash
export YT_DLP_SLEEP=2
```
The value is the number of seconds to sleep before each `yt-dlp` request.
