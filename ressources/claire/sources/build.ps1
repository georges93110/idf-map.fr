$ErrorActionPreference = 'Stop'
$target = Split-Path -Parent $PSScriptRoot
$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
$vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs) { throw 'Visual C++ x86 est introuvable.' }
$msvc = (Get-ChildItem -LiteralPath (Join-Path $vs 'VC\Tools\MSVC') -Directory | Sort-Object Name -Descending | Select-Object -First 1).FullName
$kits = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10'
$sdk = (Get-ChildItem -LiteralPath "$kits\Include" -Directory | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'um\Windows.h') } | Sort-Object Name -Descending | Select-Object -First 1).Name
$scratch = Join-Path $env:TEMP ('Claire-build-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $scratch | Out-Null
Push-Location $scratch
try {
    & "$msvc\bin\Hostx64\x86\cl.exe" /nologo /EHsc /O2 /MT /utf-8 /std:c++17 /DUNICODE /D_UNICODE /I "$msvc\include" /I "$kits\Include\$sdk\ucrt" /I "$kits\Include\$sdk\um" /I "$kits\Include\$sdk\shared" "/Fe:$target\claire-render.exe" (Join-Path $PSScriptRoot 'Render.cpp') (Join-Path $PSScriptRoot 'ElanNative.cpp') /link /LIBPATH:"$msvc\lib\x86" /LIBPATH:"$kits\Lib\$sdk\ucrt\x86" /LIBPATH:"$kits\Lib\$sdk\um\x86" kernel32.lib
    if ($LASTEXITCODE -ne 0) { throw 'La compilation du moteur a échoué.' }
} finally { Pop-Location; Get-ChildItem -LiteralPath $scratch -File | Remove-Item; Remove-Item -LiteralPath $scratch }
