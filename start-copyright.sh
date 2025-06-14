#!/usr/bin/env bash
set -e

# Ensure a Python virtual environment with required packages and start the app
root_dir="$(dirname "$0")"
venv_dir="$root_dir/venv"

if [ ! -d "$venv_dir" ]; then
    echo "Creating virtual environment at $venv_dir"
    python3 -m venv "$venv_dir"
fi

source "$venv_dir/bin/activate"

pip install --upgrade pip
pip install -r "$root_dir/requirements.txt"

if command -v nvidia-smi >/dev/null 2>&1 && nvidia-smi >/dev/null 2>&1; then
    echo "GPU detected - installing CUDA build of torch"
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
else
    echo "No GPU detected - installing CPU build of torch"
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

if [ ! -d "$root_dir/frontend/node_modules" ]; then
    (cd "$root_dir/frontend" && npm install)
fi

python "$root_dir/manage.py" runserver 0.0.0.0:8000 &
backend_pid=$!
(cd "$root_dir/frontend" && npm run dev -- --host 0.0.0.0) &
frontend_pid=$!

ip_addr=$(hostname -I | awk '{print $1}')
if [ -z "$ip_addr" ]; then
    ip_addr="localhost"
fi

echo "Backend available on http://${ip_addr}:8000"
echo "Frontend available on http://${ip_addr}:5173"

wait $backend_pid $frontend_pid
