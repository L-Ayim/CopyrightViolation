# Ensure a Python virtual environment with required packages and start the app
$ErrorActionPreference = 'Stop'
$venvPath = Join-Path $PSScriptRoot 'venv'

if (!(Test-Path $venvPath)) {
    Write-Host "Creating virtual environment at $venvPath"
    python -m venv $venvPath
}

# Activate the environment
$activate = Join-Path $venvPath 'Scripts' 'Activate.ps1'
& $activate

# Upgrade pip and install common requirements
pip install --upgrade pip
pip install -r requirements.txt

# Detect GPU using nvidia-smi if available
$gpu = $false
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    try {
        nvidia-smi > $null
        if ($LASTEXITCODE -eq 0) { $gpu = $true }
    } catch {}
}

if ($gpu) {
    Write-Host "GPU detected - installing CUDA build of torch"
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
} else {
    Write-Host "No GPU detected - installing CPU build of torch"
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
}

# Ensure frontend deps
if (!(Test-Path (Join-Path $PSScriptRoot 'frontend' 'node_modules'))) {
    Push-Location frontend
    npm install
    Pop-Location
}

# Start backend and frontend allowing LAN access
$backend = Start-Process -FilePath python -ArgumentList 'manage.py','runserver','0.0.0.0:8000' -PassThru
Push-Location frontend
$frontend = Start-Process -FilePath npm -ArgumentList 'run','dev','--','--host','0.0.0.0' -PassThru
Pop-Location

Write-Host "Backend available on http://<your-ip>:8000" -ForegroundColor Green
Write-Host "Frontend available on http://<your-ip>:5173" -ForegroundColor Green

Wait-Process -Id $backend.Id,$frontend.Id
