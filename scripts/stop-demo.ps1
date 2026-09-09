<#
.SYNOPSIS
  Stop everything start-demo.ps1 started.

.DESCRIPTION
  Kills whatever is listening on the three demo ports rather than hunting for
  process names — `php`, `node` and `python` are all things you might have
  running for other reasons, and a demo script should not take them with it.
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'SilentlyContinue'

$ports = @(
    @{ Port = 5173; Name = 'client' },
    @{ Port = 8000; Name = 'api' },
    @{ Port = 8001; Name = 'vision' }
)

Write-Host ''

foreach ($entry in $ports) {
    # An idle port makes Get-NetTCPConnection raise a CIM "no matching objects"
    # error that $ErrorActionPreference does not swallow, so stopping a stack
    # that was only half up painted the screen red for no reason. Nothing about
    # a free port is an error here — it is the outcome we wanted.
    try {
        $owners = Get-NetTCPConnection -LocalPort $entry.Port -State Listen -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique
    } catch {
        $owners = @()
    }

    if (-not $owners) {
        Write-Host "  $($entry.Name) (:$($entry.Port)) was not running" -ForegroundColor DarkGray
        continue
    }

    foreach ($processId in $owners) {
        $process = Get-Process -Id $processId
        Stop-Process -Id $processId -Force
        Write-Host "  stopped $($entry.Name) (:$($entry.Port)) - $($process.ProcessName) $processId" -ForegroundColor Yellow
    }

    # Kill, then check, then kill again. One pass is not enough: `npm run
    # preview` is a shell that spawns node, a killed child can leave the parent
    # holding the socket, and a port that is still bound when start-demo runs
    # means Vite fails to take it (strictPort) while the *old* server keeps
    # answering. The symptom is the worst kind — you rebuild, the page does not
    # change, and nothing anywhere reports an error.
    for ($attempt = 1; $attempt -le 5; $attempt++) {
        Start-Sleep -Milliseconds 400

        try {
            $left = Get-NetTCPConnection -LocalPort $entry.Port -State Listen -ErrorAction Stop |
                Select-Object -ExpandProperty OwningProcess -Unique
        } catch {
            $left = @()
        }

        if (-not $left) { break }

        foreach ($processId in $left) {
            $process = Get-Process -Id $processId
            Stop-Process -Id $processId -Force
            Write-Host "  also stopped $($process.ProcessName) $processId holding :$($entry.Port)" -ForegroundColor Yellow
        }
    }

    try {
        $stubborn = Get-NetTCPConnection -LocalPort $entry.Port -State Listen -ErrorAction Stop
    } catch {
        $stubborn = $null
    }

    if ($stubborn) {
        Write-Host "  WARNING :$($entry.Port) is still held - start-demo will serve a stale build" -ForegroundColor Red
    }
}

Write-Host ''
