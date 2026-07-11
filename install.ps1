$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoUrl = "https://github.com/DannyIRUMVA/gihanga-command-line-interface.git"
$InstallDir = if ($env:GIHANGA_INSTALL_DIR) { $env:GIHANGA_INSTALL_DIR } else { Join-Path $HOME ".gihanga-cli" }

function Require-Command($Name) {
	if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
		throw "'$Name' is required but was not found. Install Git, Node.js, and npm, then run this script again."
	}
}

Require-Command git
Require-Command node
Require-Command npm

if (Test-Path -LiteralPath (Join-Path $InstallDir ".git")) {
	Write-Host "Updating Gihanga CLI in $InstallDir"
	git -C $InstallDir pull --ff-only
} elseif (Test-Path -LiteralPath $InstallDir) {
	throw "$InstallDir exists but is not a git repository. Set GIHANGA_INSTALL_DIR to another path or remove that folder."
} else {
	Write-Host "Installing Gihanga CLI into $InstallDir"
	git clone $RepoUrl $InstallDir
}

Set-Location $InstallDir
npm install --ignore-scripts
npm run build
Push-Location "packages/coding-agent"
npm link
Pop-Location

Write-Host ""
Write-Host "Gihanga CLI installed successfully."
Write-Host "Run: gihanga --help"
