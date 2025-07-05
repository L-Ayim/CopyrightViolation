# start-copyright.ps1
$ErrorActionPreference = 'Stop'
$venvPath = Join-Path $PSScriptRoot 'venv'

if (!(Test-Path $venvPath)) {
    Write-Host "Creating virtual environment at $venvPath"
    python -m venv $venvPath
}

# Activate the environment
$activate = Join-Path (Join-Path $venvPath 'Scripts') 'Activate.ps1'
& $activate

# Upgrade pip and install dependencies
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Ensure latest yt-dlp
Write-Host "Ensuring latest yt-dlp is installed..."
python -m pip install --upgrade yt-dlp

# GPU detection & Torch variant management (unchanged)...
$gpu = $false
$forceCuda = $env:FORCE_CUDA
$forceCpu  = $env:FORCE_CPU
if ($forceCuda) {
    $gpu = $true
} elseif (-not $forceCpu) {
    if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
        try { nvidia-smi > $null; if ($LASTEXITCODE -eq 0) { $gpu = $true } } catch {}
    }
}

$torchCuda = $false
try {
    & python -c "import torch,sys; sys.exit(0 if torch.version.cuda else 1)" 2>$null
    if ($LASTEXITCODE -eq 0) { $torchCuda = $true }
} catch {}

if ($gpu) {
    if (-not $torchCuda) {
        Write-Host "GPU detected - installing CUDA build of torch"
        python -m pip install --force-reinstall --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
    } else {
        Write-Host "GPU detected and CUDA build of torch already installed"
    }
} else {
    if ($torchCuda) {
        Write-Host "CPU mode but CUDA build installed - reinstalling CPU build"
        python -m pip install --force-reinstall --no-cache-dir torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
    } else {
        Write-Host "No GPU detected and CPU build of torch already installed"
    }
}

# ---- Frontend setup ----
if (!(Test-Path (Join-Path (Join-Path $PSScriptRoot 'frontend') 'node_modules'))) {
    Push-Location frontend
    npm install
    Pop-Location
}

# ---- Start backend with Uvicorn and frontend with Vite ----
$backend = Start-Process -FilePath uvicorn `
    -ArgumentList "backend.asgi:application","--host","0.0.0.0","--port","8000","--reload" `
    -PassThru

$npmExe = Join-Path $PSScriptRoot 'frontend\node_modules\.bin\npm.cmd'
if (-not (Test-Path $npmExe)) { $npmExe = 'npm.cmd' }

$frontend = Start-Process `
    -FilePath $npmExe `
    -ArgumentList 'run','dev','--','--host','0.0.0.0' `
    -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') `
    -NoNewWindow `
    -PassThru

# ---- Show LAN access URLs ----
try {
    $ipAddr = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*'
    } | Select-Object -First 1 -ExpandProperty IPAddress
} catch {
    $ipAddr = 'localhost'
}

Write-Host "Backend available on http://${ipAddr}:8000" -ForegroundColor Green
Write-Host "Frontend available on http://${ipAddr}:5173" -ForegroundColor Green

# ---- Wait for both processes ----
Wait-Process -Id $backend.Id,$frontend.Id
