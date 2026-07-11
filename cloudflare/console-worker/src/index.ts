const REPO_URL = "https://github.com/DannyIRUMVA/gihanga-command-line-interface.git";

const SHELL_INSTALL_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL}"
INSTALL_DIR="\${GIHANGA_INSTALL_DIR:-$HOME/.gihanga-cli}"

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Error: '$1' is required but was not found." >&2
		exit 1
	fi
}

require_command git
require_command node
require_command npm

if [ -d "$INSTALL_DIR/.git" ]; then
	echo "Updating Gihanga CLI in $INSTALL_DIR"
	git -C "$INSTALL_DIR" pull --ff-only
elif [ -e "$INSTALL_DIR" ]; then
	echo "Error: $INSTALL_DIR exists but is not a git repository." >&2
	echo "Set GIHANGA_INSTALL_DIR to another path or remove that folder." >&2
	exit 1
else
	echo "Installing Gihanga CLI into $INSTALL_DIR"
	git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
npm install --ignore-scripts
npm run build
(cd packages/coding-agent && npm link)

echo ""
echo "Gihanga CLI installed successfully."
echo "Run: gihanga --help"
`;

const POWERSHELL_INSTALL_SCRIPT = `$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoUrl = "${REPO_URL}"
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
`;

const HOME_HTML = `<!doctype html>
<html lang="rw">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Gihanga CLI</title>
  <style>
    :root { color-scheme: dark; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #070a12; color: #f4f7fb; }
    main { width: min(920px, calc(100% - 32px)); }
    pre { overflow-x: auto; padding: 20px; border: 1px solid #243049; border-radius: 14px; background: #0e1526; }
    a { color: #86efac; }
    .muted { color: #a8b3c7; }
  </style>
</head>
<body>
  <main>
    <pre>┌──────────────────────────────┐
│          Gihanga CLI          │
│ Umufasha wa AI mu Kinyarwanda │
└───────────────┬──────────────┘
                │
                ▼
        install kuri terminal</pre>
    <h1>Gihanga CLI</h1>
    <p class="muted">Umufasha wa AI mu kwandika kode muri terminal, ushyira Ikinyarwanda imbere.</p>
    <h2>Linux / macOS</h2>
    <pre>curl -fsSL https://console.upskillsafrica.org/install.sh | bash</pre>
    <h2>Windows PowerShell</h2>
    <pre>iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex</pre>
    <p><a href="${REPO_URL.replace(".git", "")}">GitHub repository</a></p>
  </main>
</body>
</html>`;

function withHeaders(body: BodyInit, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	headers.set("Cache-Control", "public, max-age=300");
	headers.set("X-Content-Type-Options", "nosniff");
	return new Response(body, { ...init, headers });
}

export default {
	fetch(request: Request): Response {
		const url = new URL(request.url);
		if (url.pathname === "/install.sh") {
			return withHeaders(SHELL_INSTALL_SCRIPT, {
				headers: { "Content-Type": "text/x-shellscript; charset=utf-8" },
			});
		}
		if (url.pathname === "/install.ps1") {
			return withHeaders(POWERSHELL_INSTALL_SCRIPT, {
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}
		if (url.pathname === "/" || url.pathname === "/index.html") {
			return withHeaders(HOME_HTML, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		return withHeaders("Not found\n", {
			status: 404,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	},
};
