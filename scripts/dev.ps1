# Windows equivalent of `pnpm dev` (the package script uses POSIX shell syntax that cmd cannot run).
# Usage: .\scripts\dev.ps1          core only, on 127.0.0.1:7440
#        .\scripts\dev.ps1 -Web     also the panel on :7441, in a second window
param([switch]$Web)

$root = Split-Path -Parent $PSScriptRoot
if (-not $env:NODE_COMPILE_CACHE) { $env:NODE_COMPILE_CACHE = Join-Path $root "node_modules\.cache\node-compile" }

if ($Web) {
  Start-Process powershell -WorkingDirectory $root -ArgumentList "-NoExit", "-Command", "pnpm --filter @apx/web dev"
}

Push-Location (Join-Path $root "apps\core")
try { node --watch src/main.ts } finally { Pop-Location }
