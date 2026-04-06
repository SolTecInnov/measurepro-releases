$projectDir = "C:\Users\jfpri\measurepro-electron"
$asarBin    = "$projectDir\node_modules\@electron\asar\bin\asar.js"
$staging    = "C:\Users\jfpri\AppData\Local\Temp\mp-staging"
$outAsar    = "C:\Users\jfpri\AppData\Local\Temp\mp-app.asar"
$destAsar   = "$projectDir\release-builds\win-unpacked\resources\app.asar"

$exclude = @(".bin",".cache",".package-lock.json",
  "electron","electron-builder","vite","@vitejs","typescript","esbuild","@esbuild",
  "rollup","@rollup","rolldown","@rolldown","node-gyp","concurrently","cross-env","wait-on",
  "tree-kill","app-builder-lib","app-builder-bin","builder-util","builder-util-runtime",
  "electron-publish","dmg-builder","electron-builder-squirrel-windows","7zip-bin",
  "resedit","pe-library","read-binary-file-arch","autoprefixer","postcss","tailwindcss",
  "@electron\rebuild","@electron\universal","@electron\notarize","@electron\osx-sign")

Write-Host "--- MeasurePRO Repack ---"
Stop-Process -Name "MeasurePRO" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "electron"   -Force -ErrorAction SilentlyContinue
Start-Sleep 1

Write-Host "Cleaning staging..."
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging -ErrorAction SilentlyContinue }
New-Item -ItemType Directory "$staging\node_modules" | Out-Null

Write-Host "Copying app files..."
# Use robocopy for reliable directory copies (no double-nesting issue)
robocopy "$projectDir\dist"     "$staging\dist"     /E /NFL /NDL /NJH /NJS | Out-Null
robocopy "$projectDir\electron" "$staging\electron" /E /NFL /NDL /NJH /NJS | Out-Null
Copy-Item "$projectDir\package.json" "$staging\package.json"

Write-Host "Copying node_modules with robocopy..."
$copied = 0; $skipped = 0
foreach ($entry in Get-ChildItem "$projectDir\node_modules" -ErrorAction SilentlyContinue) {
  if ($exclude -contains $entry.Name) { $skipped++; continue }
  if ($entry.LinkType -ne $null)      { $skipped++; continue }
  robocopy $entry.FullName "$staging\node_modules\$($entry.Name)" /E /NFL /NDL /NJH /NJS /XJ 2>&1 | Out-Null
  $copied++
}
Write-Host "Copied: $copied  Skipped: $skipped"

# Verify - check for package.json directly in the module folder (not nested)
foreach ($m in @("ms","debug","serialport")) {
  $pkgJson = "$staging\node_modules\$m\package.json"
  $exists = Test-Path $pkgJson
  Write-Host "$(if($exists){'[OK]'}else{'[MISSING]'}) $m\package.json"
  if (-not $exists) { Write-Host "ABORTING"; exit 1 }
}

Write-Host "Packing asar..."
if (Test-Path $outAsar) { Remove-Item $outAsar }
node $asarBin pack $staging $outAsar 2>&1 | Where-Object { $_ -notmatch "^$" }

if (Test-Path $outAsar) {
  $sizeMB = [math]::Round((Get-Item $outAsar).Length / 1MB, 1)
  Write-Host "Packed: $sizeMB MB"
  Copy-Item -Force $outAsar $destAsar
  Write-Host "Deployed! Launching..."
  Start-Process "$projectDir\release-builds\win-unpacked\MeasurePRO.exe"
} else {
  Write-Host "PACK FAILED"
  exit 1
}
