param(
  [string]$Environment = "Staging",
  [string]$Application = "Practice Test Automation",
  [string]$AppVersion  = "2.5.3",
  [string]$Build       = "2026.01.28.1",
  [string]$Browser     = "Chrome",
  [string]$BaseURL     = "https://practicetestautomation.com/practice-test-login/",
  [string]$Name        = "RAMYA SREE"
)

$ErrorActionPreference = 'Continue'

# Get the latest timestamped results folder
$latest = Get-ChildItem "allure-results" -Directory |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

if (-not $latest) {
  Write-Error "No results found in allure-results"
  exit 1
}

$ts = $latest.Name

# STEP 5: Create a filesystem-safe timestamp string for naming the HTML
# (Format you asked for: dd-MM-yyyyTHH:mm:ss; for file name, replace ':' with '-')
$tsLabel = (Get-Date).ToString("dd-MM-yyyyTHH:mm:ss")
$tsFile  = $tsLabel -replace ":", "-"   # safe for file names

# --- Create environment.properties inside this run folder ---
$envFile = Join-Path $latest.FullName "environment.properties"
@"
Environment=$Environment
Application=$Application
AppVersion=$AppVersion
Build=$Build
Browser=$Browser
BaseURL=$BaseURL
Name=$Name
"@ | Set-Content -Path $envFile -Encoding utf8  # If you see BOM chars, switch to no-BOM method

Write-Host "Wrote: $envFile"

# --- Add executor.json (before 'allure generate') ---
$executorObj = [ordered]@{
  name       = "Local Run"                        # e.g., Jenkins, GitHub Actions, Azure Pipelines
  type       = "other"                            # jenkins | github | gitlab | azure | teamcity | bamboo | circleci | other
  url        = ""                                 # CI base URL (optional)
  buildName  = "Developer machine"                # e.g., "Job e2e-main #342"
  buildUrl   = ""                                 # Deep link to build/run (optional)
  reportName = "Playwright E2E - $Environment"    # Title shown in report header
  reportUrl  = ""                                 # If you publish the report somewhere, put the URL here
}

$executorPath = Join-Path $latest.FullName "executor.json"
$executorJson = $executorObj | ConvertTo-Json -Depth 5
$executorJson | Set-Content -Path $executorPath -Encoding utf8
Write-Host "`n--- Wrote executor.json ---"
Write-Host $executorJson

# Make sure allure-report folder exists (singular per your script)
$outBase = "allure-report"
if (!(Test-Path $outBase)) {
  New-Item -ItemType Directory -Path $outBase | Out-Null
}

$report = $outBase 
# Generate HTML report into a subfolder (normal Allure output)
$report = Join-Path $outBase ("allure-report-$ts")
Write-Host "Generating Allure HTML -> $report"

# If your Allure CLI supports --single-file, keep it; otherwise remove that flag:
# allure generate "allure-results/$ts" -o $report --clean
allure generate "allure-results/$ts" -o $report --clean --single-file

# Copy the built index.html to a single timestamped HTML at the top-level output folder
$builtIndex = Join-Path $report "index.html"
$finalHtml  = Join-Path $outBase ("allure-report-$tsFile.html")

Copy-Item $builtIndex $finalHtml -Force
# ---- Delete temp folder ----
Remove-Item -Recurse -Force $report
Write-Host "✅ Single HTML created: $finalHtml"

# --- Convert HTML to PDF and keep both files ---
$finalPdf = [System.IO.Path]::ChangeExtension($finalHtml, 'pdf')

# Find Chrome or Edge automatically
$chrome = @(
  "$Env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "$Env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
  "$Env:LocalAppData\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$edge = @(
  "$Env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$Env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

$browser = $chrome
if (-not $browser) { $browser = $edge }

if (-not $browser) {
    Write-Warning "Chrome/Edge not found to generate PDF."
}
else {
    $htmlFull = (Resolve-Path $finalHtml).Path
    $pdfFull  = (Resolve-Path (Split-Path $finalPdf -Parent)).Path + "\" + (Split-Path $finalPdf -Leaf)
    $uri      = "file:///" + ($htmlFull -replace '\\','/')

    # Try headless new
    $args = @(
        "--headless=new",
        "--allow-file-access-from-files",
        "--disable-web-security",
        "--print-to-pdf=""$pdfFull""",
        """$uri"""
    )

    Start-Process -FilePath $browser -ArgumentList $args -Wait -WindowStyle Hidden

    if (Test-Path $pdfFull) {
        Write-Host "🧾 PDF created: $pdfFull"
    }
    else {
        Write-Warning "PDF not generated."
    }
}

# Open the local HTML file directly
Start-Process $finalHtml

