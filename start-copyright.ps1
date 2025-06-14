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
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121
} else {
    Write-Host "No GPU detected - installing CPU build of torch"
    python -m pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
}

# Ensure frontend deps
if (!(Test-Path (Join-Path (Join-Path $PSScriptRoot 'frontend') 'node_modules'))) {
    Push-Location frontend
    npm install
    Pop-Location
}

# Start backend and frontend allowing LAN access
$backend = Start-Process -FilePath python -ArgumentList 'manage.py','runserver','0.0.0.0:8000' -PassThru
Push-Location frontend
$frontend = Start-Process -FilePath npm -ArgumentList 'run','dev','--','--host','0.0.0.0' -PassThru
Pop-Location

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

Wait-Process -Id $backend.Id,$frontend.Id
