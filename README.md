# Copyright Violation

This project provides a small Django backend and React frontend for downloading and separating audio tracks using Demucs.

## Setup

On Windows, use `start-copyright.ps1` to create a virtual environment and install dependencies. This script detects whether an NVIDIA GPU is present using `nvidia-smi` and installs the CUDA-enabled build of PyTorch when available. Set the environment variable `FORCE_CUDA=1` before running the script to force GPU packages, or `FORCE_CPU=1` to force the CPU build.

If you set up the environment manually, be sure to install the appropriate PyTorch build. For GPU acceleration, run:

```powershell
python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
```

Then start Django:

```powershell
python manage.py runserver
```

## Checking GPU availability

You can verify that PyTorch sees your GPU with:

```powershell
python - <<'PY'
import torch
print('CUDA available:', torch.cuda.is_available())
print('CUDA version:', torch.version.cuda)
PY
```

If this prints `CUDA available: True`, the separation process will run on the GPU.
If you have a capable GPU but it isn't detected automatically, ensure `nvidia-smi` is installed and in your `PATH`. You can also force installation of the CUDA build by setting `FORCE_CUDA=1` when running the startup script.
