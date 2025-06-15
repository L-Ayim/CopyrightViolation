# Ensure a Python virtual environment with required packages and start the app
$ErrorActionPreference = 'Stop'
$venvPath = Join-Path $PSScriptRoot 'venv'

if (!(Test-Path $venvPath)) {
    Write-Host "Creating virtual environment at $venvPath"
    python -m venv $venvPath
}

# Activate the environment
$activate = Join-Path (Join-Path $venvPath 'Scripts') 'Activate.ps1'
& $activate

# Upgrade pip and install common requirements using the virtualenv Python
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# Detect GPU using nvidia-smi unless overridden with env vars
$gpu = $false
$forceCuda = $env:FORCE_CUDA
$forceCpu  = $env:FORCE_CPU
if ($forceCuda) {
    $gpu = $true
} elseif (-not $forceCpu) {
    if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
        try {
            nvidia-smi > $null
            if ($LASTEXITCODE -eq 0) { $gpu = $true }
        } catch {}
    }
}

# Check which variant of torch is already installed
$torchCuda = $false
try {
    & python -c "import torch,sys; sys.exit(0 if torch.version.cuda else 1)" 2>$null
    if ($LASTEXITCODE -eq 0) { $torchCuda = $true }
} catch {}

if ($gpu) {
    if (-not $torchCuda) {
        Write-Host "GPU detected - installing CUDA build of torch"
        # Force reinstall to ensure the CUDA-enabled build replaces any CPU-only version
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

# Ensure frontend deps
if (!(Test-Path (Join-Path (Join-Path $PSScriptRoot 'frontend') 'node_modules'))) {
    Push-Location frontend
    npm install
    Pop-Location
}

# Start backend and frontend allowing LAN access
$backend = Start-Process -FilePath python `
    -ArgumentList 'manage.py','runserver','0.0.0.0:8000' `
    -PassThru

# Launch Vite via npm.cmd in the frontend folder, in the same window
$npmExe = Join-Path $PSScriptRoot 'frontend\node_modules\.bin\npm.cmd'
if (-not (Test-Path $npmExe)) { $npmExe = 'npm.cmd' }

$frontend = Start-Process `
    -FilePath $npmExe `
    -ArgumentList 'run','dev','--','--host','0.0.0.0' `
    -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') `
    -NoNewWindow `
    -PassThru

# Determine the LAN IPv4 address for display. Fallback to hostname lookup if
# Get-NetIPAddress isn't available (e.g. on non-Windows hosts).
try {
    $ipAddr = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*'
    } | Select-Object -First 1 -ExpandProperty IPAddress
} catch {
    $ipAddr = ([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
        Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
        Select-Object -First 1).IPAddressToString
}

if (-not $ipAddr) {
    try {
        $ipAddr = ([System.Net.Dns]::GetHostAddresses([System.Net.Dns]::GetHostName()) |
            Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } |
            Select-Object -First 1).IPAddressToString
    } catch {
        $ipAddr = 'localhost'
    }
}

Write-Host "Backend available on http://${ipAddr}:8000" -ForegroundColor Green
Write-Host "Frontend available on http://${ipAddr}:5173" -ForegroundColor Green

# Wait for both the Django process and the Vite dev server job to exit.
Wait-Process -Id $backend.Id,$frontend.Id
