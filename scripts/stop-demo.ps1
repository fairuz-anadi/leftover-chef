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
    $owners = Get-NetTCPConnection -LocalPort $entry.Port -State Listen |
        Select-Object -ExpandProperty OwningProcess -Unique

    if (-not $owners) {
        Write-Host "  $($entry.Name) (:$($entry.Port)) was not running" -ForegroundColor DarkGray
        continue
    }

    foreach ($processId in $owners) {
        $process = Get-Process -Id $processId
        Stop-Process -Id $processId -Force
        Write-Host "  stopped $($entry.Name) (:$($entry.Port)) - $($process.ProcessName) $processId" -ForegroundColor Yellow
    }
}

Write-Host ''
