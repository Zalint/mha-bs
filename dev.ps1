# =============================================================================
# MHA - Bureau de Suivi - Gestion des services de developpement
#
# Usage :
#   .\dev.ps1 start      Demarre PostgreSQL + backend + frontend
#   .\dev.ps1 stop       Arrete backend + frontend (laisse PostgreSQL)
#   .\dev.ps1 stop-all   Arrete tout y compris PostgreSQL (necessite admin)
#   .\dev.ps1 restart    Redemarre les 3 services
#   .\dev.ps1 status     Affiche l'etat de chaque service
#   .\dev.ps1 logs       Affiche les 20 dernieres lignes des logs
#
# Note : le demarrage/arret de PostgreSQL necessite des droits administrateur.
# Si tu n'es pas admin, demarre PostgreSQL une fois manuellement et utilise
# uniquement les commandes start/stop pour le backend et le frontend.
#
# Pour autoriser l'execution du script (une seule fois) :
#   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# =============================================================================

param(
    [Parameter(Mandatory=$false, Position=0)]
    [ValidateSet('start', 'stop', 'stop-all', 'restart', 'status', 'logs')]
    [string]$Command = 'status'
)

$ErrorActionPreference = 'Continue'

# --- Configuration ---
$ProjectRoot = $PSScriptRoot
$PostgresServiceName = 'postgresql-x64-17'
$BackendPort = 3001
$FrontendPort = 5173
$PostgresPort = 5432
$PidDir = Join-Path $ProjectRoot '.pids'
$LogDir = Join-Path $ProjectRoot '.logs'

# --- Helpers d'affichage ---
function Write-OK   { param($Message) Write-Host "[OK]   $Message" -ForegroundColor Green }
function Write-KO   { param($Message) Write-Host "[KO]   $Message" -ForegroundColor Red }
function Write-Info { param($Message) Write-Host "[..]   $Message" -ForegroundColor Cyan }
function Write-Warn { param($Message) Write-Host "[!!]   $Message" -ForegroundColor Yellow }

function Test-Port {
    param([int]$Port)
    # 1) Tentative directe en IPv4 (Vite + Express n'ecoutent souvent que sur 127.0.0.1)
    foreach ($addr in @('127.0.0.1', '::1')) {
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $client.ReceiveTimeout = 500
            $client.SendTimeout = 500
            $async = $client.BeginConnect($addr, $Port, $null, $null)
            $wait = $async.AsyncWaitHandle.WaitOne(500, $false)
            if ($wait -and $client.Connected) {
                $client.Close()
                return $true
            }
            $client.Close()
        } catch {
            # ignore et essaie l'autre host
        }
    }
    # 2) Fallback : check via netstat (capture les bindings 0.0.0.0 et tous les autres)
    try {
        $found = & netstat -an 2>$null | Select-String -SimpleMatch ":$Port " | Where-Object { $_ -match 'LISTENING' }
        return ($null -ne $found -and $found.Count -gt 0)
    } catch {
        return $false
    }
}

# --- PostgreSQL ---
function Get-PostgresStatus {
    try {
        $svc = Get-Service -Name $PostgresServiceName -ErrorAction Stop
        return $svc.Status.ToString()
    } catch {
        return 'NotFound'
    }
}

function Start-Postgres {
    # Si le port 5432 repond deja, on considere que PostgreSQL tourne (peu importe via service ou pg_ctl)
    if (Test-Port -Port $PostgresPort) {
        Write-OK "PostgreSQL deja en ecoute sur port $PostgresPort"
        return
    }
    $status = Get-PostgresStatus
    if ($status -eq 'NotFound') {
        Write-KO "Service $PostgresServiceName introuvable. Verifiez l'installation de PostgreSQL."
        return
    }
    Write-Info "Demarrage de PostgreSQL ($PostgresServiceName)..."
    try {
        Start-Service -Name $PostgresServiceName -ErrorAction Stop
        Start-Sleep -Seconds 2
        if (Test-Port -Port $PostgresPort) {
            Write-OK "PostgreSQL demarre"
        } else {
            Write-Warn "PostgreSQL : service demarre mais port $PostgresPort pas encore ouvert"
        }
    } catch {
        Write-KO "Echec demarrage PostgreSQL : $($_.Exception.Message)"
        Write-Warn "Relance ce script dans un terminal Administrateur, ou demarre PostgreSQL manuellement."
    }
}

function Stop-Postgres {
    $status = Get-PostgresStatus
    if ($status -eq 'Stopped') {
        Write-OK "PostgreSQL deja arrete"
        return
    }
    if ($status -eq 'NotFound') {
        Write-Warn "Service $PostgresServiceName introuvable."
        return
    }
    Write-Info "Arret de PostgreSQL..."
    try {
        Stop-Service -Name $PostgresServiceName -Force -ErrorAction Stop
        Write-OK "PostgreSQL arrete"
    } catch {
        Write-KO "Echec arret PostgreSQL : $($_.Exception.Message)"
        Write-Warn "Relance ce script dans un terminal Administrateur."
    }
}

# --- Services Node (backend / frontend) ---
function Ensure-RuntimeDirs {
    if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir | Out-Null }
    if (-not (Test-Path $PidDir)) { New-Item -ItemType Directory -Path $PidDir | Out-Null }
}

function Start-NodeService {
    param(
        [string]$Name,
        [string]$NpmScript,
        [int]$Port,
        [int]$WaitSeconds = 4
    )

    if (Test-Port -Port $Port) {
        Write-Warn "$Name : port $Port deja occupe - service deja en cours ?"
        return
    }

    Ensure-RuntimeDirs
    $logFile = Join-Path $LogDir "$Name.log"
    $errFile = Join-Path $LogDir "$Name.err.log"

    # Nettoie les anciens logs pour eviter la confusion
    if (Test-Path $logFile) { Clear-Content $logFile -ErrorAction SilentlyContinue }
    if (Test-Path $errFile) { Clear-Content $errFile -ErrorAction SilentlyContinue }

    Write-Info "Demarrage $Name (npm run $NpmScript)..."

    $process = Start-Process -FilePath 'npm.cmd' `
        -ArgumentList @('run', $NpmScript) `
        -WorkingDirectory $ProjectRoot `
        -RedirectStandardOutput $logFile `
        -RedirectStandardError $errFile `
        -WindowStyle Hidden `
        -PassThru

    if ($null -eq $process) {
        Write-KO "$Name : impossible de lancer le processus"
        return
    }

    $process.Id | Out-File -FilePath (Join-Path $PidDir "$Name.pid") -Encoding ascii

    # Attendre l'ouverture du port
    $started = $false
    for ($i = 0; $i -lt $WaitSeconds * 2; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-Port -Port $Port) { $started = $true; break }
    }

    if ($started) {
        Write-OK "$Name demarre (PID $($process.Id), port $Port)"
    } else {
        Write-Warn "$Name : pas encore en ecoute sur $Port apres ${WaitSeconds}s. Verifie : $logFile"
    }
}

function Stop-NodeService {
    param([string]$Name)

    $pidFile = Join-Path $PidDir "$Name.pid"
    $processId = $null
    if (Test-Path $pidFile) {
        $processId = (Get-Content $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    }

    $stopped = $false

    if ($processId) {
        try {
            $existing = Get-Process -Id $processId -ErrorAction Stop
            # Tue l'arbre complet (taskkill /T) pour attraper les sous-processus tsx/vite
            & taskkill /F /T /PID $processId 2>$null | Out-Null
            Write-OK "$Name arrete (PID $processId)"
            $stopped = $true
        } catch {
            # Process pas trouve, peut-etre orphelin
        }
        Remove-Item $pidFile -ErrorAction SilentlyContinue
    }

    if (-not $stopped) {
        # Fallback : cherche par port
        $port = if ($Name -eq 'backend') { $BackendPort } else { $FrontendPort }
        if (Test-Port -Port $port) {
            $netstat = & netstat -ano | Select-String -Pattern ":$port\s.*LISTENING"
            foreach ($line in $netstat) {
                $line.ToString().Trim() -match '\s(\d+)$' | Out-Null
                $foundPid = $matches[1]
                if ($foundPid) {
                    & taskkill /F /T /PID $foundPid 2>$null | Out-Null
                    Write-OK "$Name arrete (PID $foundPid, trouve via port $port)"
                    $stopped = $true
                }
            }
        }
    }

    if (-not $stopped) {
        Write-Info "$Name : pas de processus actif"
    }
}

# --- Affichage statut ---
function Show-Status {
    Write-Host ""
    Write-Host "=== Etat des services MHA Bureau de Suivi ===" -ForegroundColor Cyan
    Write-Host ""

    $pgStatus = Get-PostgresStatus
    $pgPortOpen = Test-Port -Port $PostgresPort
    if ($pgPortOpen) {
        if ($pgStatus -eq 'Running') {
            Write-OK ("PostgreSQL (port {0,5})  : Running (Windows service)" -f $PostgresPort)
        } else {
            Write-OK ("PostgreSQL (port {0,5})  : Running (lance hors service Windows, ex. pg_ctl)" -f $PostgresPort)
        }
    } else {
        switch ($pgStatus) {
            'Stopped'  { Write-KO ("PostgreSQL (port {0,5})  : Stopped" -f $PostgresPort) }
            'NotFound' { Write-KO ("PostgreSQL (port {0,5})  : Service introuvable" -f $PostgresPort) }
            default    { Write-KO ("PostgreSQL (port {0,5})  : $pgStatus" -f $PostgresPort) }
        }
    }

    if (Test-Port -Port $BackendPort) {
        Write-OK ("Backend  (port {0,5})  : Running   http://localhost:{0}/api/healthz" -f $BackendPort)
    } else {
        Write-KO ("Backend  (port {0,5})  : Stopped" -f $BackendPort)
    }

    if (Test-Port -Port $FrontendPort) {
        Write-OK ("Frontend (port {0,5})  : Running   http://localhost:{0}" -f $FrontendPort)
    } else {
        Write-KO ("Frontend (port {0,5})  : Stopped" -f $FrontendPort)
    }

    Write-Host ""
}

function Show-Logs {
    foreach ($name in @('backend', 'frontend')) {
        $logFile = Join-Path $LogDir "$name.log"
        $errFile = Join-Path $LogDir "$name.err.log"
        Write-Host ""
        Write-Host "=== Logs $name (20 dernieres lignes) ===" -ForegroundColor Cyan
        if (Test-Path $logFile) {
            $lines = Get-Content $logFile -Tail 20 -ErrorAction SilentlyContinue
            if ($lines) { $lines | ForEach-Object { Write-Host "  $_" } }
            else { Write-Host "  (vide)" -ForegroundColor Gray }
        } else {
            Write-Host "  (pas de log : $logFile)" -ForegroundColor Gray
        }

        if (Test-Path $errFile) {
            $errs = Get-Content $errFile -Tail 10 -ErrorAction SilentlyContinue | Where-Object { $_.Trim() -ne '' }
            if ($errs) {
                Write-Host "  --- Erreurs ---" -ForegroundColor Yellow
                $errs | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
            }
        }
    }
    Write-Host ""
}

# --- Main ---
Push-Location $ProjectRoot
try {
    switch ($Command) {
        'start' {
            Start-Postgres
            Start-NodeService -Name 'backend'  -NpmScript 'dev:backend'  -Port $BackendPort -WaitSeconds 5
            Start-NodeService -Name 'frontend' -NpmScript 'dev:frontend' -Port $FrontendPort -WaitSeconds 6
            Show-Status
        }
        'stop' {
            Stop-NodeService -Name 'frontend'
            Stop-NodeService -Name 'backend'
            Show-Status
        }
        'stop-all' {
            Stop-NodeService -Name 'frontend'
            Stop-NodeService -Name 'backend'
            Stop-Postgres
            Show-Status
        }
        'restart' {
            Stop-NodeService -Name 'frontend'
            Stop-NodeService -Name 'backend'
            Start-Sleep -Seconds 2
            Start-Postgres
            Start-NodeService -Name 'backend'  -NpmScript 'dev:backend'  -Port $BackendPort -WaitSeconds 5
            Start-NodeService -Name 'frontend' -NpmScript 'dev:frontend' -Port $FrontendPort -WaitSeconds 6
            Show-Status
        }
        'status' { Show-Status }
        'logs'   { Show-Logs }
    }
} finally {
    Pop-Location
}
