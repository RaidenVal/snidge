# Stop immediately when there is an error
$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path "$PSScriptRoot\.."
$ProjectDir = Join-Path $RootDir "native\windows-capture-helper"
$OutDir = Join-Path $RootDir "resources\win"
$ExeName = "snidge-wgc-capture.exe"

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir | Out-Null
}

Push-Location $ProjectDir
try {
    cargo build --release
} finally {
    Pop-Location
}

Copy-Item -Path (Join-Path $ProjectDir "target\release\$ExeName") -Destination $OutDir -Force

Write-Host "Built $(Join-Path $OutDir $ExeName)"