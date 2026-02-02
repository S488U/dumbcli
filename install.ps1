function Print-Banner {
@"
██████╗ ██╗   ██╗███╗   ███╗███████╗╔██████╗██╗     ██╗
██╔══██╗██║   ██║████╗ ████║██╔══██║║██╔═══╝██║     ██║
██║  ██║██║   ██║██╔████╔██║███████║║██║    ██║     ██║
██║  ██║██║   ██║██║╚██╔╝██║██╔══██║║██║    ██║     ██║
██████╔╝╚██████╔╝██║ ╚═╝ ██║███████║╚██████╗███████╗██║
╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝╚══════╝╚═╝
"@ | Write-Host -ForegroundColor Cyan
Write-Host '      The "Dumb" Way to Manage Smart Commands'
Write-Host ""
}

Print-Banner
Write-Host "DumbCLI Installer"
Write-Host "Preparing to install or update DumbCLI...`n"

# 🖥️ OS detection (intelligent display)
$osInfo = Get-CimInstance Win32_OperatingSystem
$osCaption = $osInfo.Caption
$osVersion = $osInfo.Version
Write-Host "Detected OS: $osCaption ($osVersion)"

# 🧪 Check requirements
$requirements = @("git", "node", "npm")
foreach ($req in $requirements) {
    if (-not (Get-Command $req -ErrorAction SilentlyContinue)) {
        Write-Error "Error: $req is not installed. Please install it first."
        exit
    }
}

# ⚠️ Node.js version check
$nodeVersion = (node -v).TrimStart("v")
$maxVersion = "23.9.0"
if ($nodeVersion -gt $maxVersion) {
    Write-Warning "Warning: Node.js v$nodeVersion may be too new. Use v$maxVersion or below."
}

# 📁 Install or Update (permanent install dir)
$installDir = Join-Path $env:LOCALAPPDATA "DumbCLI"

Write-Host "Install directory: $installDir"
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir | Out-Null
}

if (Test-Path (Join-Path $installDir ".git")) {
    Write-Host "Update detected. Pulling latest changes..."
    Set-Location $installDir
    $gitStatus = git status --porcelain
    if ($gitStatus) {
        Write-Warning "Error: Local changes found in $installDir. Please commit or stash before updating."
        exit 1
    }
    git pull --ff-only origin main
    Write-Host "Updating dependencies..."
} else {
    $hasFiles = Get-ChildItem -LiteralPath $installDir -Force | Where-Object { $_.Name -notin @(".", "..") }
    if ($hasFiles) {
        Write-Warning "Error: $installDir is not empty and not a git repo."
        Write-Host "Please delete it or move its contents, then re-run the installer."
        exit 1
    }
    Write-Host "First-time install. Cloning DumbCLI into $installDir..."
    git clone https://github.com/S488U/dumbcli.git $installDir
    Set-Location $installDir
    Write-Host "Installing dependencies..."
}

# 📦 NPM install
npm install

# 🔗 Global link (auto-fix old global link if needed)
Write-Host "Linking DumbCLI globally..."
$existingDumb = Get-Command dumb -ErrorAction SilentlyContinue
if ($existingDumb -and $existingDumb.Source) {
    $resolvedDumb = $existingDumb.Source
    if ($resolvedDumb -notlike "$installDir*") {
        Write-Host "Found existing global 'dumb' at $resolvedDumb"
        Write-Host "Removing old link..."
        npm unlink -g cli 2>$null
        npm unlink -g dumbcli 2>$null
    }
}
npm link

# ✅ Done
Write-Host ""
Write-Host "Done. DumbCLI is ready to use."
Write-Host "Run: dumb   (or: d)"
Write-Host "Docs & GitHub: https://github.com/S488U/dumbcli"
Write-Host ""
