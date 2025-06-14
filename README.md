# Copyright Violation

This project provides a small Django backend and React frontend for downloading and separating audio tracks using Demucs.

## Setup

On Windows, use `start-copyright.ps1` to create a virtual environment and install dependencies. This script detects whether an NVIDIA GPU is present using `nvidia-smi` and installs the CUDA-enabled build of PyTorch when available.

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
