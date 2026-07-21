const REPO_URL = "https://github.com/DannyIRUMVA/gihanga-command-line-interface.git";
const UPSKILLSAFRICA_LOGO_SVG = "https://upskillsafrica.org/main-logo.svg";
const UPSKILLSAFRICA_FAVICON_SVG = "https://upskillsafrica.org/favicon.svg";
const UPSKILLSAFRICA_FAVICON_ICO = "https://upskillsafrica.org/favicon.ico";
const UPSKILLSAFRICA_APPLE_ICON = "https://upskillsafrica.org/logo.png";
const UPSKILLSAFRICA_AI_SERVICE = "https://upskillsafrica-ai-backend.boyg87059.workers.dev";


const SITE_WEBMANIFEST = JSON.stringify({
	name: "Gihanga CLI",
	short_name: "Gihanga",
	description: "Kinyarwanda-first terminal AI coding assistant by Upskillsafrica.",
	start_url: "/",
	display: "standalone",
	background_color: "#07111F",
	theme_color: "#34D399",
	icons: [
		{ src: UPSKILLSAFRICA_FAVICON_SVG, sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
		{ src: UPSKILLSAFRICA_APPLE_ICON, sizes: "512x512", type: "image/png", purpose: "any maskable" },
	],
});

const SHELL_INSTALL_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL}"
INSTALL_DIR="\${GIHANGA_INSTALL_DIR:-$HOME/.gihanga-cli}"
INSTALL_LOG="\${GIHANGA_INSTALL_LOG:-\${TMPDIR:-/tmp}/gihanga-install.log}"
: > "$INSTALL_LOG"

run_quiet() {
	local label="$1"
	shift
	echo "$label"
	if ! "$@" >>"$INSTALL_LOG" 2>&1; then
		echo "Error: $label failed. Log: $INSTALL_LOG" >&2
		tail -40 "$INSTALL_LOG" >&2 || true
		exit 1
	fi
}

run_quiet_shell() {
	local label="$1"
	shift
	echo "$label"
	if ! bash -lc "$*" >>"$INSTALL_LOG" 2>&1; then
		echo "Error: $label failed. Log: $INSTALL_LOG" >&2
		tail -40 "$INSTALL_LOG" >&2 || true
		exit 1
	fi
}

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Error: '$1' is required but was not found." >&2
		exit 1
	fi
}

require_command git
require_command node
require_command npm

remove_stale_gihanga_helper() {
	local existing=""
	existing="$(command -v gihanga 2>/dev/null || true)"
	[ -n "$existing" ] || return 0
	if [ -f "$existing" ] || [ -L "$existing" ]; then
		if "$existing" --help 2>/dev/null | grep -q "Gihanga CLI helper"; then
			if rm -f "$existing" 2>/dev/null; then
				hash -r 2>/dev/null || true
				echo "Removed old Gihanga helper: $existing"
			else
				echo "Warning: old Gihanga helper is still in PATH: $existing" >&2
				echo "Remove it manually or make sure the npm global bin directory appears earlier in PATH." >&2
			fi
		fi
	fi
}

remove_stale_gihanga_helper

NPM_PREFIX="\${npm_config_prefix:-$(npm config get prefix 2>/dev/null || true)}"
if [ -n "$NPM_PREFIX" ] && [ ! -w "$NPM_PREFIX" ]; then
	export npm_config_prefix="\${npm_config_prefix:-$HOME/.local}"
	mkdir -p "$npm_config_prefix/bin"
fi

if [ -d "$INSTALL_DIR/.git" ]; then
	run_quiet "Kuvugurura Gihanga..." git -C "$INSTALL_DIR" fetch --quiet origin main
	run_quiet "Guhuza Gihanga..." git -C "$INSTALL_DIR" reset --hard --quiet origin/main
elif [ -e "$INSTALL_DIR" ]; then
	echo "Error: $INSTALL_DIR exists but is not a git repository." >&2
	echo "Set GIHANGA_INSTALL_DIR to another path or remove that folder." >&2
	exit 1
else
	run_quiet "Kwinjiza Gihanga..." git clone --quiet "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
run_quiet "Gutegura amapakeji..." npm install --ignore-scripts --silent --no-fund --no-audit --loglevel=error
run_quiet "Kubaka Gihanga..." npm run build --silent
remove_stale_gihanga_helper
run_quiet_shell "Gushyira Gihanga muri terminal..." "cd packages/coding-agent && npm link --silent"
hash -r 2>/dev/null || true
remove_stale_gihanga_helper

GIHANGA_AGENT_DIR="\${GIHANGA_AGENT_DIR:-$HOME/.gihanga/agent}"
mkdir -p "$GIHANGA_AGENT_DIR/skills" "$GIHANGA_AGENT_DIR/data" "$GIHANGA_AGENT_DIR/scripts"
cp -R "$INSTALL_DIR/resources/gihanga/agent/skills/gihanga-community" "$GIHANGA_AGENT_DIR/skills/"
cp "$INSTALL_DIR"/resources/gihanga/agent/data/* "$GIHANGA_AGENT_DIR/data/"
if [ -f "$INSTALL_DIR/resources/gihanga/agent/models.json" ]; then
	cp "$INSTALL_DIR/resources/gihanga/agent/models.json" "$GIHANGA_AGENT_DIR/models.json"
	MODELS_PATH="$GIHANGA_AGENT_DIR/models.json" node <<'JS'
const fs = require("fs");
const path = process.env.MODELS_PATH;
const data = JSON.parse(fs.readFileSync(path, "utf8"));
for (const provider of Object.values(data.providers || {})) {
	for (const model of provider.models || []) {
		model.input = ["text"];
		if (Array.isArray(model.output)) model.output = model.output.filter((value) => value === "text");
		if (Array.isArray(model.output) && model.output.length === 0) delete model.output;
	}
}
fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\\n");
JS
fi
cp "$INSTALL_DIR"/resources/gihanga/agent/scripts/* "$GIHANGA_AGENT_DIR/scripts/"

if [ "\${GIHANGA_INSTALL_MBAZA_NLP:-0}" = "1" ] || [ "\${GIHANGA_INSTALL_MBAZA_NLP:-}" = "true" ]; then
	MBAZA_ARGS=(--dataset "\${GIHANGA_MBAZA_NLP_DATASET:-mbazaNLP/kinyarwanda_monolingual_v01.0}")
	if [ "\${GIHANGA_MBAZA_METADATA_ONLY:-0}" = "1" ] || [ "\${GIHANGA_MBAZA_METADATA_ONLY:-}" = "true" ]; then
		MBAZA_ARGS+=(--metadata-only)
	fi
	node "$GIHANGA_AGENT_DIR/scripts/import-mbaza-nlp.mjs" "\${MBAZA_ARGS[@]}"
fi

if [ -n "\${AZURE_OPENAI_API_KEY:-}" ] && { [ -n "\${AZURE_OPENAI_BASE_URL:-}" ] || [ -n "\${AZURE_OPENAI_RESOURCE_NAME:-}" ]; }; then
	AUTH_PATH="$GIHANGA_AGENT_DIR/auth.json" node <<'JS'
const fs = require("fs");
const path = process.env.AUTH_PATH;
const baseFromResource = (name) => "https://" + name + ".openai.azure.com";
const resourceFromBase = (baseUrl) => {
	try { return new URL(baseUrl).hostname.split(".")[0] || undefined; } catch { return undefined; }
};
const current = fs.existsSync(path) ? JSON.parse(fs.readFileSync(path, "utf8") || "{}") : {};
const resourceName = process.env.AZURE_OPENAI_RESOURCE_NAME || resourceFromBase(process.env.AZURE_OPENAI_BASE_URL || "");
const baseUrl = process.env.AZURE_OPENAI_BASE_URL || (resourceName ? baseFromResource(resourceName) : undefined);
current["azure-openai-responses"] = {
	type: "api_key",
	key: "AZURE_OPENAI_API_KEY",
	env: {
		...(baseUrl ? { AZURE_OPENAI_BASE_URL: baseUrl } : {}),
		...(resourceName ? { AZURE_OPENAI_RESOURCE_NAME: resourceName } : {}),
		...(process.env.AZURE_OPENAI_API_VERSION ? { AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION } : {}),
	},
};
fs.mkdirSync(require("path").dirname(path), { recursive: true, mode: 0o700 });
fs.writeFileSync(path, JSON.stringify(current, null, 2), { mode: 0o600 });
JS
fi

echo ""
echo "Gihanga CLI installed successfully."
echo "Kinyarwanda keyword data installed in: $GIHANGA_AGENT_DIR"
if command -v gihanga >/dev/null 2>&1; then
	GIHANGA_BIN="$(command -v gihanga)"
	echo "Installed command: $GIHANGA_BIN"
	echo "Run: gihanga --help"
elif [ -n "\${npm_config_prefix:-}" ]; then
	echo "Add $npm_config_prefix/bin to your PATH if needed."
	echo "Then run: gihanga --help"
else
	echo "Run: gihanga --help"
fi
`;

const POWERSHELL_INSTALL_SCRIPT = `$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoUrl = "${REPO_URL}"
$InstallDir = if ($env:GIHANGA_INSTALL_DIR) { $env:GIHANGA_INSTALL_DIR } else { Join-Path $HOME ".gihanga-cli" }
$InstallLog = if ($env:GIHANGA_INSTALL_LOG) { $env:GIHANGA_INSTALL_LOG } else { Join-Path ([IO.Path]::GetTempPath()) "gihanga-install.log" }
Set-Content -Path $InstallLog -Value ""

function Invoke-Quiet($Label, [ScriptBlock]$Command) {
	Write-Host $Label
	try {
		& $Command *> $InstallLog
	} catch {
		Write-Error ($Label + " failed. Log: " + $InstallLog)
		if (Test-Path -LiteralPath $InstallLog) { Get-Content -Tail 40 $InstallLog | Write-Error }
		throw
	}
	if ($LASTEXITCODE -ne 0) {
		Write-Error ($Label + " failed. Log: " + $InstallLog)
		if (Test-Path -LiteralPath $InstallLog) { Get-Content -Tail 40 $InstallLog | Write-Error }
		exit $LASTEXITCODE
	}
}

function Require-Command($Name) {
	if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
		throw "'$Name' is required but was not found. Install Git, Node.js, and npm, then run this script again."
	}
}

Require-Command git
Require-Command node
Require-Command npm

if (Test-Path -LiteralPath (Join-Path $InstallDir ".git")) {
	Invoke-Quiet "Kuvugurura Gihanga..." { git -C $InstallDir pull --ff-only --quiet }
} elseif (Test-Path -LiteralPath $InstallDir) {
	throw "$InstallDir exists but is not a git repository. Set GIHANGA_INSTALL_DIR to another path or remove that folder."
} else {
	Invoke-Quiet "Kwinjiza Gihanga..." { git clone --quiet $RepoUrl $InstallDir }
}

Set-Location $InstallDir
Invoke-Quiet "Gutegura amapakeji..." { npm install --ignore-scripts --silent --no-fund --no-audit --loglevel=error }
Invoke-Quiet "Kubaka Gihanga..." { npm run build --silent }
Push-Location "packages/coding-agent"
Invoke-Quiet "Gushyira Gihanga muri terminal..." { npm link --silent }
Pop-Location

$GihangaAgentDir = if ($env:GIHANGA_AGENT_DIR) { $env:GIHANGA_AGENT_DIR } else { Join-Path $HOME ".gihanga/agent" }
New-Item -ItemType Directory -Force -Path (Join-Path $GihangaAgentDir "skills") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $GihangaAgentDir "data") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $GihangaAgentDir "scripts") | Out-Null
Copy-Item -Recurse -Force (Join-Path $InstallDir "resources/gihanga/agent/skills/gihanga-community") (Join-Path $GihangaAgentDir "skills")
Copy-Item -Force (Join-Path $InstallDir "resources/gihanga/agent/data/*") (Join-Path $GihangaAgentDir "data")
$ModelsJson = Join-Path $InstallDir "resources/gihanga/agent/models.json"
if (Test-Path -LiteralPath $ModelsJson) {
	$TargetModelsJson = Join-Path $GihangaAgentDir "models.json"
	Copy-Item -Force $ModelsJson $TargetModelsJson
	$Models = Get-Content -Raw $TargetModelsJson | ConvertFrom-Json -Depth 20
	foreach ($ProviderProperty in $Models.providers.PSObject.Properties) {
		foreach ($Model in $ProviderProperty.Value.models) {
			$Model.input = @("text")
			if ($Model.PSObject.Properties.Name -contains "output") {
				$TextOutputs = @($Model.output | Where-Object { $_ -eq "text" })
				if ($TextOutputs.Count -gt 0) { $Model.output = $TextOutputs } else { $Model.PSObject.Properties.Remove("output") }
			}
		}
	}
	$Models | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 -Path $TargetModelsJson
}
Copy-Item -Force (Join-Path $InstallDir "resources/gihanga/agent/scripts/*") (Join-Path $GihangaAgentDir "scripts")

if ($env:GIHANGA_INSTALL_MBAZA_NLP -eq "1" -or $env:GIHANGA_INSTALL_MBAZA_NLP -eq "true") {
	$MbazaDataset = if ($env:GIHANGA_MBAZA_NLP_DATASET) { $env:GIHANGA_MBAZA_NLP_DATASET } else { "mbazaNLP/kinyarwanda_monolingual_v01.0" }
	$MbazaArgs = @((Join-Path $GihangaAgentDir "scripts/import-mbaza-nlp.mjs"), "--dataset", $MbazaDataset)
	if ($env:GIHANGA_MBAZA_METADATA_ONLY -eq "1" -or $env:GIHANGA_MBAZA_METADATA_ONLY -eq "true") {
		$MbazaArgs += "--metadata-only"
	}
	node @MbazaArgs
}

if ($env:AZURE_OPENAI_API_KEY -and ($env:AZURE_OPENAI_BASE_URL -or $env:AZURE_OPENAI_RESOURCE_NAME)) {
	$AuthPath = Join-Path $GihangaAgentDir "auth.json"
	$Auth = if (Test-Path -LiteralPath $AuthPath) { Get-Content -Raw $AuthPath | ConvertFrom-Json -AsHashtable } else { @{} }
	$ResourceName = $env:AZURE_OPENAI_RESOURCE_NAME
	if (-not $ResourceName -and $env:AZURE_OPENAI_BASE_URL) {
		try { $ResourceName = ([Uri]$env:AZURE_OPENAI_BASE_URL).Host.Split('.')[0] } catch { $ResourceName = $null }
	}
	$BaseUrl = if ($env:AZURE_OPENAI_BASE_URL) { $env:AZURE_OPENAI_BASE_URL } elseif ($ResourceName) { "https://$ResourceName.openai.azure.com" } else { $null }
	$AzureEnv = @{}
	if ($BaseUrl) { $AzureEnv["AZURE_OPENAI_BASE_URL"] = $BaseUrl }
	if ($ResourceName) { $AzureEnv["AZURE_OPENAI_RESOURCE_NAME"] = $ResourceName }
	if ($env:AZURE_OPENAI_API_VERSION) { $AzureEnv["AZURE_OPENAI_API_VERSION"] = $env:AZURE_OPENAI_API_VERSION }
	$Auth["azure-openai-responses"] = @{
		type = "api_key"
		key = "AZURE_OPENAI_API_KEY"
		env = $AzureEnv
	}
	$Auth | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 -Path $AuthPath
}

Write-Host ""
Write-Host "Gihanga CLI installed successfully."
Write-Host "Kinyarwanda keyword data installed in: $GihangaAgentDir"
Write-Host "Run: gihanga --help"
`;


const SITE_NAV = `
  <header class="relative mx-auto flex w-[90%] max-w-[1200px] flex-wrap items-center justify-between gap-3 px-0 py-4 sm:py-5">
    <a href="/" class="flex min-w-0 items-center gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white shadow-glow sm:h-12 sm:w-12">
        <img src="${UPSKILLSAFRICA_LOGO_SVG}" alt="UpskillsAfrica Foundation" class="h-8 w-8 object-contain sm:h-9 sm:w-9" loading="eager" decoding="async" />
      </span>
      <div class="min-w-0">
        <p class="truncate text-base font-black tracking-tight sm:text-lg">Gihanga CLI <span class="ml-1 rounded-md border border-gihanga-emerald/30 bg-gihanga-emerald/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-gihanga-emerald sm:ml-2 sm:px-2 sm:py-1 sm:text-[10px]">Alpha</span></p>
        <p class="hidden text-xs text-gihanga-muted sm:block">Kinyarwanda-first terminal AI · v0.1.0-alpha.3</p>
      </div>
    </a>
    <nav class="order-3 flex w-full items-center justify-between gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#dce1fb] backdrop-blur sm:order-none sm:w-auto sm:justify-end sm:gap-5 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:text-sm">
      <a class="hover:text-gihanga-text" href="/#install">Install</a>
      <a class="hover:text-gihanga-text" href="/docs">Docs</a>
      <a class="hover:text-gihanga-text" href="/privacy">Privacy</a>
      <a class="hover:text-gihanga-text" href="/terms">Terms</a>
    </nav>
  </header>`;

const SITE_FOOTER = `
  <footer class="relative mx-auto w-[90%] max-w-[1200px] px-0 py-10 text-sm text-slate-500">
    <div class="flex flex-col justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
      <p>Gihanga CLI - Kinyarwanda-first terminal AI coding assistant · Alpha v0.1.0-alpha.3</p>
      <a class="text-gihanga-emerald hover:text-[#68fcbf]" href="https://upskillsafrica.org" rel="noopener noreferrer">Powered by Upskillsafrica Foundation</a>
    </div>
  </footer>`;

function pageShell(title: string, description: string, body: string): string {
	return `<!doctype html>
<html lang="rw" class="scroll-smooth">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="${description}" />
  <title>${title}</title>
  <meta name="theme-color" content="#07111F" />
  <link rel="icon" href="${UPSKILLSAFRICA_FAVICON_SVG}" type="image/svg+xml" />
  <link rel="shortcut icon" href="${UPSKILLSAFRICA_FAVICON_ICO}" />
  <link rel="apple-touch-icon" href="${UPSKILLSAFRICA_APPLE_ICON}" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Hanken Grotesk', 'ui-sans-serif', 'system-ui'],
            mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular']
          },
          colors: {
            gihanga: {
              bg: '#0c1324',
              deep: '#020617',
              glass: 'rgba(15, 23, 42, 0.60)',
              panel: '#191f31',
              panelHigh: '#23293c',
              emerald: '#34D399',
              cyan: '#22D3EE',
              amber: '#FBBF24',
              text: '#F1F5F9',
              muted: '#94A3B8'
            }
          },
          boxShadow: {
            glow: '0 0 30px rgba(52, 211, 153, 0.28)',
            cyanGlow: '0 0 32px rgba(34, 211, 238, 0.18)'
          }
        }
      }
    };
  </script>
  <style>
    html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
    body { background: #0c1324; }
    * { box-sizing: border-box; }
    main, section, article, aside, div, header, footer, nav { min-width: 0; }
    img, svg { max-width: 100%; }
    a, p, li, h1, h2, h3, h4, span, label { overflow-wrap: anywhere; }
    input, select, button, textarea { max-width: 100%; }
    pre { max-width: 100%; -webkit-overflow-scrolling: touch; }
    pre code { white-space: pre; }
    :not(pre) > code { overflow-wrap: anywhere; }
    .neo-grid { background-image: radial-gradient(circle at 1px 1px, rgba(148,163,184,.10) 1px, transparent 0); background-size: 32px 32px; }
    [data-reveal] { opacity: 0; transform: translateY(22px); transition: opacity 700ms ease, transform 700ms ease; }
    [data-reveal].is-visible { opacity: 1; transform: translateY(0); }
    [data-reveal="terminal"] { transform: translateY(14px) scale(.985); }
    [data-reveal="terminal"].is-visible { transform: translateY(0) scale(1); }
    @media (max-width: 640px) {
      .w-\[90\%\] { width: calc(100% - 1.25rem) !important; }
      h1 { font-size: clamp(2.25rem, 12vw, 3.55rem) !important; line-height: .99 !important; letter-spacing: -0.045em !important; }
      h2 { font-size: clamp(1.45rem, 7vw, 2.15rem) !important; line-height: 1.08 !important; }
      h3 { line-height: 1.12 !important; }
      p, li { line-height: 1.68 !important; }
      pre { font-size: 11px !important; line-height: 1.65 !important; padding: 1rem !important; border-radius: .95rem !important; }
      article, section { scroll-margin-top: 1rem; }
      section[class*="p-8"], article[class*="p-8"], section[class*="p-6"], article[class*="p-6"], aside[class*="p-5"], a[class*="p-5"] { padding: 1rem !important; }
      section[class*="py-8"], section[class*="py-10"], main[class*="py-8"] { padding-top: 1.5rem !important; padding-bottom: 1.5rem !important; }
      .mobile-pad { padding: 1rem !important; }
      .mobile-terminal { border-radius: 1.25rem !important; }
      .rounded-\[2rem\] { border-radius: 1.25rem !important; }
      .tracking-\[0\.16em\], .tracking-\[0\.2em\] { letter-spacing: .09em !important; }
    }
    @media (max-width: 380px) {
      nav { gap: .35rem !important; padding-left: .6rem !important; padding-right: .6rem !important; }
      nav a { font-size: 11px !important; }
      h1 { font-size: clamp(2rem, 11vw, 3rem) !important; }
    }
    @media (prefers-reduced-motion: reduce) { [data-reveal] { opacity: 1; transform: none; transition: none; } }
  </style>
</head>
<body class="min-h-screen bg-gihanga-bg font-sans text-gihanga-text antialiased neo-grid">
  <div class="pointer-events-none fixed inset-0 overflow-hidden">
    <div class="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-gihanga-emerald/20 blur-3xl"></div>
    <div class="absolute right-0 top-48 h-96 w-96 rounded-full bg-gihanga-cyan/10 blur-3xl"></div>
    <div class="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-gihanga-amber/10 blur-3xl"></div>
  </div>
  ${SITE_NAV}
  ${body}
  ${SITE_FOOTER}
  <script>
    lucide.createIcons();
    const revealItems = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        }
      }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
      revealItems.forEach((item) => observer.observe(item));
    } else {
      revealItems.forEach((item) => item.classList.add('is-visible'));
    }
  </script>
</body>
</html>`;
}

const HOME_HTML = pageShell(
	"Gihanga CLI - Kinyarwanda-first AI coding assistant",
	"Install Gihanga CLI, a Kinyarwanda-first terminal AI coding assistant powered by Upskillsafrica.",
	`
  <main class="relative">
    <section class="mx-auto grid w-[90%] max-w-[1200px] items-center gap-8 py-6 sm:py-10 lg:grid-cols-[1.03fr_0.97fr] lg:py-16">
      <div data-reveal>
        <div class="mb-5 inline-flex items-center gap-2 rounded-full border border-gihanga-emerald/25 bg-gihanga-emerald/10 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-[0.16em] text-gihanga-emerald">
          <span class="h-2 w-2 rounded-full bg-gihanga-emerald shadow-glow"></span>
          Console live · install Gihanga today
        </div>
        <h1 class="max-w-4xl text-5xl font-black leading-[0.94] tracking-[-0.055em] text-gihanga-text sm:text-6xl lg:text-7xl">
          AI coding muri terminal, Kinyarwanda-first.
        </h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-[#dce1fb] sm:mt-6 sm:text-lg sm:leading-8">
          Install Gihanga CLI, injira muri Upskillsafrica, wishyure credits na Mobile Money, ukoreshe models muri terminal yawe. Commands nka <code class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-gihanga-emerald">/kwinjira</code>, <code class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-gihanga-emerald">/ubumenyi</code>, na <code class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-gihanga-emerald">/sohoka</code> ziri local-workflow friendly.
        </p>
        <div class="mt-7 flex flex-col gap-3 sm:flex-row">
          <a href="#install" class="inline-flex items-center justify-center gap-2 rounded-xl bg-gihanga-emerald px-6 py-4 font-black text-[#003825] shadow-glow transition hover:-translate-y-0.5 hover:bg-[#5af0b3]">Tangira install <i data-lucide="arrow-right" class="h-5 w-5"></i></a>
          <a href="/credits" class="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-4 font-bold text-gihanga-text transition hover:-translate-y-0.5 hover:bg-white/10">Reba credits</a>
          <a href="/docs" class="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-4 font-bold text-gihanga-text transition hover:-translate-y-0.5 hover:bg-white/5">Soma docs</a>
        </div>
        <div class="mt-8 grid max-w-2xl gap-3 text-sm text-[#cbd5e1] sm:grid-cols-3">
          <div class="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Access</p><p class="mt-1 font-bold text-gihanga-text">One account</p></div>
          <div class="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Models</p><p class="mt-1 font-bold text-gihanga-text">Upskillsafrica</p></div>
          <div class="rounded-xl border border-white/10 bg-white/[0.04] p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Payments</p><p class="mt-1 font-bold text-gihanga-text">Mobile Money</p></div>
        </div>
      </div>

      <div data-reveal="terminal" class="relative min-w-0">
        <div class="absolute -inset-2 rounded-[1.5rem] bg-gradient-to-br from-gihanga-emerald/25 via-gihanga-cyan/10 to-gihanga-amber/15 blur-xl sm:-inset-3 sm:rounded-[2rem]"></div>
        <div class="mobile-terminal relative min-w-0 overflow-hidden rounded-[1.5rem] border border-white/12 bg-[#07101f]/95 shadow-2xl shadow-emerald-950/30 backdrop-blur sm:rounded-[2rem]">
          <div class="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div class="flex items-center gap-2"><span class="h-3 w-3 rounded-full bg-red-400"></span><span class="h-3 w-3 rounded-full bg-gihanga-amber"></span><span class="h-3 w-3 rounded-full bg-gihanga-emerald"></span><span class="ml-2 font-mono text-xs text-gihanga-muted">gihanga-terminal</span></div>
            <span class="rounded-full border border-gihanga-emerald/20 bg-gihanga-emerald/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-gihanga-emerald">online</span>
          </div>
          <pre class="max-h-[520px] overflow-x-auto p-4 font-mono text-[11px] leading-6 text-slate-200 sm:max-h-[590px] sm:p-7 sm:text-[13px] sm:leading-7"><code>$ curl -fsSL https://console.upskillsafrica.org/install.sh | bash
Kwinjiza Gihanga...
Gutegura amapakeji...
Kubaka Gihanga...
Gushyira Gihanga muri terminal...

$ gihanga

       /\\        ✦
  ____/  \\____   Rwanda
 | imisozi igihumbi | sun
 ‾‾‾‾‾‾‾‾‾‾‾‾‾
 Gihanga CLI · Powered by Upskillsafrica Foundation

╭─ Gihanga kumurimo · ~/Projects/app
╰─ gpt-4o · upskillsafrica · 0 RWF · Kigali 22°C 🌤

/kwinjira    injira muri Upskillsafrica
/ubumenyi    koresha ubumenyi bwa project
/sohoka      sohoka muri Gihanga</code></pre>
        </div>
      </div>
    </section>

    <section data-reveal id="install" class="mx-auto w-[90%] max-w-[1200px] py-8">
      <div class="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p class="font-mono text-xs font-bold uppercase tracking-[0.14em] text-gihanga-emerald">Install scripts</p>
          <h2 class="mt-2 text-3xl font-black text-gihanga-text sm:text-4xl">Install kuri OS yawe</h2>
          <p class="mt-2 max-w-2xl text-gihanga-muted">Installer ikora clone/update, install, build, npm link, hanyuma ishyira skills, data, scripts, na curated Upskillsafrica model config muri <code>~/.gihanga/agent</code>.</p>
        </div>
        <a href="/docs#subscription" class="text-sm font-semibold text-gihanga-emerald hover:text-[#68fcbf]">Reba subscription flow →</a>
      </div>
      <div class="grid gap-5 lg:grid-cols-2">
        <article class="mobile-pad rounded-2xl border border-cyan-400/20 bg-gihanga-glass p-6 backdrop-blur">
          <div class="mb-4 flex items-center justify-between gap-3"><div class="flex items-center gap-3"><span class="grid h-12 w-12 place-items-center rounded-xl bg-cyan-400/15 text-[#a2eeff]"><i data-lucide="monitor" class="h-6 w-6"></i></span><div><h3 class="text-xl font-bold text-gihanga-text">🐧 🍎 Linux / macOS</h3><p class="text-sm text-gihanga-muted">Bash installer</p></div></div></div>
          <div class="relative min-w-0"><pre class="overflow-x-auto rounded-xl border border-white/10 bg-gihanga-deep p-4 font-mono text-[11px] text-[#68fcbf] sm:pr-20 sm:text-sm"><code>curl -fsSL https://console.upskillsafrica.org/install.sh | bash</code></pre></div>
        </article>
        <article class="mobile-pad rounded-2xl border border-blue-400/20 bg-gihanga-glass p-6 backdrop-blur">
          <div class="mb-4 flex items-center gap-3"><span class="grid h-12 w-12 place-items-center rounded-xl bg-blue-400/15 text-blue-200"><i data-lucide="panel-top" class="h-6 w-6"></i></span><div><h3 class="text-xl font-bold text-gihanga-text">🪟 Windows PowerShell</h3><p class="text-sm text-gihanga-muted">Native Windows installer</p></div></div>
          <pre class="overflow-x-auto rounded-xl border border-white/10 bg-gihanga-deep p-4 font-mono text-[11px] text-[#68fcbf] sm:text-sm"><code>iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex</code></pre>
        </article>
      </div>
    </section>

    <section data-reveal class="mx-auto grid w-[90%] max-w-[1200px] gap-5 py-10 lg:grid-cols-3">
      <article class="rounded-2xl border border-emerald-400/20 bg-gihanga-emerald/10 p-6"><i data-lucide="languages" class="mb-4 h-8 w-8 text-gihanga-emerald"></i><h3 class="text-xl font-bold text-gihanga-text">Kinyarwanda-first</h3><p class="mt-2 text-[#dce1fb]">Answers default to Kinyarwanda unless English is requested. The interface uses familiar local commands and clear terminal language.</p></article>
      <article class="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-6"><i data-lucide="brain-circuit" class="mb-4 h-8 w-8 text-gihanga-cyan"></i><h3 class="text-xl font-bold text-gihanga-text">Ubumenyi bwa project</h3><p class="mt-2 text-[#dce1fb]">Bundled Gihanga community guidance and project context help the assistant understand your workflow.</p></article>
      <article class="rounded-2xl border border-amber-400/20 bg-gihanga-amber/10 p-6"><i data-lucide="wallet-cards" class="mb-4 h-8 w-8 text-gihanga-amber"></i><h3 class="text-xl font-bold text-gihanga-text">Mobile Money credits</h3><p class="mt-2 text-[#dce1fb]">Choose a plan, enter your phone number, confirm on your phone, and continue using Gihanga models.</p></article>
    </section>
  </main>`
);

const DOCS_HTML = pageShell(
	"Gihanga Docs - Install, login, credits, ubumenyi",
	"Documentation for installing and using Gihanga CLI with Upskillsafrica models, Mobile Money subscriptions, and Kinyarwanda-first workflows.",
	`
  <main data-reveal class="relative mx-auto w-[90%] max-w-[1200px] py-8">
    <section class="rounded-2xl border border-white/10 bg-gihanga-glass p-8 backdrop-blur">
      <div class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div>
          <p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-emerald">Documentation</p>
          <h1 class="mt-3 text-4xl font-black text-gihanga-text sm:text-5xl">Gihanga CLI docs</h1>
          <p class="mt-4 max-w-4xl text-[#dce1fb]">Install, login, Mobile Money credits, curated models, ubumenyi commands, and troubleshooting — all in one terminal-first guide.</p>
        </div>
        <a href="/#install" class="inline-flex items-center justify-center gap-2 rounded-lg bg-gihanga-emerald px-5 py-3 font-bold text-[#003825] shadow-glow transition hover:bg-[#5af0b3]">Install now <i data-lucide="arrow-right" class="h-5 w-5"></i></a>
      </div>
    </section>

    <section data-reveal class="mt-6 grid gap-4 md:grid-cols-3">
      <a href="#install" class="rounded-xl border border-emerald-400/20 bg-gihanga-emerald/10 p-5 transition hover:border-gihanga-emerald/60">
        <i data-lucide="terminal-square" class="h-7 w-7 text-gihanga-emerald"></i>
        <h2 class="mt-4 text-xl font-bold text-gihanga-text">Quick install</h2>
        <p class="mt-2 text-sm text-[#dce1fb]">One command for Linux/macOS, native PowerShell for Windows.</p>
      </a>
      <a href="#subscription" class="rounded-xl border border-amber-400/20 bg-gihanga-amber/10 p-5 transition hover:border-gihanga-amber/60">
        <i data-lucide="smartphone" class="h-7 w-7 text-gihanga-amber"></i>
        <h2 class="mt-4 text-xl font-bold text-gihanga-text">Mobile Money</h2>
        <p class="mt-2 text-sm text-[#dce1fb]">Choose plan, enter phone, confirm, unlock models automatically.</p>
      </a>
      <a href="#models" class="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-5 transition hover:border-gihanga-cyan/60">
        <i data-lucide="brain-circuit" class="h-7 w-7 text-gihanga-cyan"></i>
        <h2 class="mt-4 text-xl font-bold text-gihanga-text">Models + ubumenyi</h2>
        <p class="mt-2 text-sm text-[#dce1fb]">Curated Upskillsafrica models and Kinyarwanda-first project knowledge.</p>
      </a>
    </section>

    <div class="mt-6 grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside data-reveal class="h-fit rounded-xl border border-white/10 bg-gihanga-glass p-5 text-sm text-[#dce1fb] lg:sticky lg:top-5">
        <p class="mb-4 font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-emerald">Docs map</p>
        <a class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5 hover:text-gihanga-text" href="#install"><i data-lucide="download" class="h-4 w-4 text-gihanga-emerald"></i> Install</a>
        <a class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5 hover:text-gihanga-text" href="#login"><i data-lucide="user-round-check" class="h-4 w-4 text-gihanga-cyan"></i> Login / Register</a>
        <a class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5 hover:text-gihanga-text" href="#subscription"><i data-lucide="wallet-cards" class="h-4 w-4 text-gihanga-amber"></i> Subscription</a>
        <a class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5 hover:text-gihanga-text" href="#models"><i data-lucide="cpu" class="h-4 w-4 text-gihanga-emerald"></i> Models</a>
        <a class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5 hover:text-gihanga-text" href="#providers"><i data-lucide="key-round" class="h-4 w-4 text-gihanga-amber"></i> API providers</a>
        <a class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5 hover:text-gihanga-text" href="#ubumenyi"><i data-lucide="book-open-text" class="h-4 w-4 text-gihanga-cyan"></i> Ubumenyi</a>
        <a class="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-white/5 hover:text-gihanga-text" href="#troubleshooting"><i data-lucide="wrench" class="h-4 w-4 text-gihanga-amber"></i> Troubleshooting</a>
      </aside>

      <section class="space-y-5">
        <article data-reveal id="install" class="rounded-xl border border-white/10 bg-gihanga-glass p-6">
          <div class="flex items-start gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gihanga-emerald/10 text-gihanga-emerald"><i data-lucide="download" class="h-6 w-6"></i></span><div><p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-emerald">Step 01</p><h2 class="text-2xl font-bold text-gihanga-text">Install Gihanga</h2></div></div>
          <div class="mt-5 grid gap-4 lg:grid-cols-2">
            <div><p class="mb-2 text-sm font-semibold text-[#dce1fb]">Linux / macOS</p><pre class="font-mono overflow-x-auto rounded-lg bg-gihanga-deep p-4 text-sm text-[#68fcbf]"><code>curl -fsSL https://console.upskillsafrica.org/install.sh | bash</code></pre></div>
            <div><p class="mb-2 text-sm font-semibold text-[#dce1fb]">Windows PowerShell</p><pre class="font-mono overflow-x-auto rounded-lg bg-gihanga-deep p-4 text-sm text-[#68fcbf]"><code>iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex</code></pre></div>
          </div>
          <p class="mt-4 text-[#dce1fb]">Installer ikora clone/update, install/build/link quietly, hanyuma ishyira Gihanga ubumenyi, scripts, data, na model catalog muri <code>~/.gihanga/agent</code>.</p>
        </article>

        <article data-reveal id="login" class="rounded-xl border border-white/10 bg-gihanga-glass p-6">
          <div class="flex items-start gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-gihanga-cyan"><i data-lucide="user-round-check" class="h-6 w-6"></i></span><div><p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-cyan">Step 02</p><h2 class="text-2xl font-bold text-gihanga-text">Login cyangwa register</h2></div></div>
          <div class="mt-4 rounded-lg border border-white/10 bg-gihanga-deep p-4 font-mono text-sm text-[#dce1fb]">/kwinjira → Upskillsafrica account → Login / Register</div>
          <p class="mt-4 text-[#dce1fb]">Token ibikwa locally muri Gihanga config kuri machine yawe. Niba nta subscription ihari, Gihanga ihita ikwereka plans.</p>
        </article>

        <article data-reveal id="subscription" class="rounded-xl border border-white/10 bg-gihanga-glass p-6">
          <div class="flex items-start gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gihanga-amber/10 text-gihanga-amber"><i data-lucide="smartphone" class="h-6 w-6"></i></span><div><p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-amber">Step 03</p><h2 class="text-2xl font-bold text-gihanga-text">Mobile Money subscription</h2></div></div>
          <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div class="rounded-lg border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-xs text-gihanga-muted">30 MIN</p><p class="mt-1 text-xl font-black text-gihanga-text">3,000 RWF</p></div>
            <div class="rounded-lg border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-xs text-gihanga-muted">1 HOUR</p><p class="mt-1 text-xl font-black text-gihanga-text">5,000 RWF</p></div>
            <div class="rounded-lg border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-xs text-gihanga-muted">12 DAYS</p><p class="mt-1 text-xl font-black text-gihanga-text">20,000 RWF</p></div>
            <div class="rounded-lg border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-xs text-gihanga-muted">MONTHLY</p><p class="mt-1 text-xl font-black text-gihanga-text">53,000 RWF</p></div>
          </div>
          <ol class="mt-5 grid gap-3 text-[#dce1fb] sm:grid-cols-2"><li class="rounded-lg bg-white/5 p-4"><strong>1.</strong> Hitamo plan.</li><li class="rounded-lg bg-white/5 p-4"><strong>2.</strong> Andika nimero ya Mobile Money.</li><li class="rounded-lg bg-white/5 p-4"><strong>3.</strong> Emeza kuri telefoni.</li><li class="rounded-lg bg-white/5 p-4"><strong>4.</strong> Gihanga ifungura model selector.</li></ol>
          <a class="mt-5 inline-flex items-center gap-2 text-gihanga-emerald hover:text-[#68fcbf]" href="/credits">Open credits page <i data-lucide="arrow-right" class="h-4 w-4"></i></a>
        </article>

        <article data-reveal id="models" class="rounded-xl border border-white/10 bg-gihanga-glass p-6">
          <div class="flex items-start gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gihanga-emerald/10 text-gihanga-emerald"><i data-lucide="cpu" class="h-6 w-6"></i></span><div><p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-emerald">Models</p><h2 class="text-2xl font-bold text-gihanga-text">Curated Upskillsafrica models</h2></div></div>
          <p class="mt-4 text-[#dce1fb]">Gihanga shows curated Upskillsafrica models after you log in. Some organisation models, including <code>UAF_model_one</code> and <code>uaf_model_two_alpha</code>, require organisation access.</p>
        </article>

        <article data-reveal id="providers" class="rounded-xl border border-white/10 bg-gihanga-glass p-6">
          <div class="flex items-start gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gihanga-amber/10 text-gihanga-amber"><i data-lucide="key-round" class="h-6 w-6"></i></span><div><p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-amber">Optional</p><h2 class="text-2xl font-bold text-gihanga-text">Add another provider with an API key</h2></div></div>
          <p class="mt-4 text-[#dce1fb]">Upskillsafrica is the recommended default, but Gihanga can also use your own provider API key. Use this if you already have OpenRouter, Anthropic, OpenAI, Gemini, or another supported provider account.</p>
          <div class="mt-4 grid gap-4 lg:grid-cols-2">
            <div class="rounded-lg border border-white/10 bg-gihanga-deep p-4">
              <p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-muted">CLI flow</p>
              <ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-[#dce1fb]"><li>Run <code>gihanga</code>.</li><li>Type <code>/kwinjira</code>.</li><li>Choose <strong>Use an API key</strong>.</li><li>Select your provider, for example <strong>OpenRouter</strong>.</li><li>Paste your API key and choose a model.</li></ol>
            </div>
            <div class="rounded-lg border border-white/10 bg-gihanga-deep p-4">
              <p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-muted">OpenRouter example</p>
              <pre class="font-mono mt-3 overflow-x-auto rounded-md bg-black/30 p-3 text-sm text-[#68fcbf]"><code>/kwinjira
Use an API key
OpenRouter
Paste API key
/model</code></pre>
            </div>
          </div>
          <p class="mt-4 text-sm text-gihanga-muted">Note: external provider keys are user-managed. Upskillsafrica subscriptions and Mobile Money credits only apply to the <code>upskillsafrica</code> provider.</p>
        </article>

        <article data-reveal id="ubumenyi" class="rounded-xl border border-white/10 bg-gihanga-glass p-6">
          <div class="flex items-start gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cyan-400/10 text-gihanga-cyan"><i data-lucide="book-open-text" class="h-6 w-6"></i></span><div><p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-cyan">Ubumenyi</p><h2 class="text-2xl font-bold text-gihanga-text">Project knowledge commands</h2></div></div>
          <div class="mt-4 grid gap-3 font-mono text-sm text-[#68fcbf] md:grid-cols-3"><code class="rounded-lg bg-gihanga-deep p-3">ubumenyi:gihanga-community</code><code class="rounded-lg bg-gihanga-deep p-3">ubumenyi:agents-sdk</code><code class="rounded-lg bg-gihanga-deep p-3">ubumenyi:deployment</code></div>
          <p class="mt-4 text-[#dce1fb]">Ubumenyi bufasha Gihanga gukurikiza Kinyarwanda-first coding, project guidance, n'ibisabwa na community.</p>
        </article>

        <article data-reveal id="troubleshooting" class="rounded-xl border border-white/10 bg-gihanga-glass p-6">
          <div class="flex items-start gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gihanga-amber/10 text-gihanga-amber"><i data-lucide="wrench" class="h-6 w-6"></i></span><div><p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-amber">Help</p><h2 class="text-2xl font-bold text-gihanga-text">Troubleshooting</h2></div></div>
          <ul class="mt-4 grid gap-3 text-[#dce1fb]"><li class="rounded-lg bg-white/5 p-4"><strong>Installer failed:</strong> reba <code>/tmp/gihanga-install.log</code>.</li><li class="rounded-lg bg-white/5 p-4"><strong>No models:</strong> koresha <code>/kwinjira</code>.</li><li class="rounded-lg bg-white/5 p-4"><strong>Org model code missing:</strong> ongera organisation code muri account menu.</li></ul>
        </article>
      </section>
    </div>
  </main>`
);

const PRIVACY_HTML = pageShell(
	"Gihanga Privacy Policy",
	"Privacy Policy for Gihanga CLI, Upskillsafrica AI accounts, Mobile Money credits, and terminal AI workflows.",
	`
  <main data-reveal class="relative mx-auto w-[90%] max-w-[1200px] py-8">
    <section class="rounded-2xl border border-white/10 bg-gihanga-glass p-8 backdrop-blur">
      <p class="font-mono text-xs font-bold uppercase tracking-[0.16em] text-gihanga-emerald">Privacy Policy</p>
      <h1 class="mt-3 max-w-4xl text-4xl font-black leading-tight tracking-[-0.035em] text-gihanga-text sm:text-5xl">How Gihanga and Upskillsafrica protect your data</h1>
      <p class="mt-4 max-w-3xl text-[#dce1fb]">This explains what is processed when you use Gihanga CLI, the console website, Upskillsafrica AI models, Mobile Money credits, and organisation-only access.</p>
      <div class="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div class="rounded-xl border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Last updated</p><p class="mt-1 font-bold text-gihanga-text">2026-07-17</p></div>
        <div class="rounded-xl border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Service</p><p class="mt-1 font-bold text-gihanga-text">Gihanga CLI + Console</p></div>
        <div class="rounded-xl border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Operator</p><p class="mt-1 font-bold text-gihanga-text">Upskillsafrica Foundation</p></div>
      </div>
    </section>
    <section class="mt-6 space-y-5 text-[#dce1fb]">
      <article data-reveal class="rounded-xl border border-emerald-400/20 bg-gihanga-emerald/10 p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="shield-check" class="h-6 w-6 text-gihanga-emerald"></i> Privacy principles</h2><ul class="mt-4 space-y-3"><li><strong>Local-first config:</strong> tokens, provider settings, model catalog, skills, scripts, and project knowledge live on your machine under <code>~/.gihanga/agent</code>.</li><li><strong>Operational data only:</strong> account, payment, entitlement, and usage records are stored so the service can authenticate users, unlock models, and prevent abuse.</li><li><strong>No secrets by design:</strong> do not submit private keys, passwords, or customer secrets in prompts unless you intend to share them with the selected AI provider.</li></ul></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="file-lock-2" class="h-6 w-6 text-gihanga-cyan"></i> Data we process</h2><p class="mt-3">Depending on your usage, we may process account email, hashed password, login sessions, organisation-code assignments, Mobile Money phone number, transaction reference, payment status, subscription entitlement, model catalog metadata, model usage totals, timestamps, and technical request metadata.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="wallet-cards" class="h-6 w-6 text-gihanga-amber"></i> Mobile Money and credits</h2><p class="mt-3">When you start a payment, your phone number, selected plan, amount, and transaction reference are used to initiate payment, verify payment status, grant credits, prevent duplicate grants, and support account or payment issues.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="brain-circuit" class="h-6 w-6 text-gihanga-cyan"></i> AI requests and providers</h2><p class="mt-3">Prompts, code snippets, terminal context, files you explicitly provide, and tool outputs may be routed to configured AI providers such as Azure-hosted models or OpenRouter-backed models. Provider systems may process request data according to their own policies.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="building-2" class="h-6 w-6 text-gihanga-emerald"></i> Organisation models</h2><p class="mt-3">Some models are restricted to organisations. Organisation codes should be treated as access credentials and shared only with authorised members.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="lock-keyhole" class="h-6 w-6 text-gihanga-amber"></i> Security and retention</h2><p class="mt-3">Passwords are hashed, sessions are token-based, and service records are kept as needed for authentication, entitlements, abuse prevention, accounting, support, and legal obligations. You can remove local CLI data by deleting <code>~/.gihanga/agent</code>.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Contact</h2><p class="mt-3">For privacy, account, or payment requests, contact Upskillsafrica Foundation through <a class="text-gihanga-emerald hover:text-[#68fcbf]" href="https://upskillsafrica.org">upskillsafrica.org</a>.</p></article>
    </section>
  </main>`
);

const TERMS_HTML = pageShell(
	"Gihanga Terms of Service",
	"Terms of Service for using Gihanga CLI, Upskillsafrica AI models, Mobile Money credits, and organisation model access.",
	`
  <main data-reveal class="relative mx-auto w-[90%] max-w-[1200px] py-8">
    <section class="rounded-2xl border border-white/10 bg-gihanga-glass p-8 backdrop-blur">
      <p class="font-mono text-xs font-bold uppercase tracking-[0.16em] text-gihanga-emerald">Terms of Service</p>
      <h1 class="mt-3 max-w-4xl text-4xl font-black leading-tight tracking-[-0.035em] text-gihanga-text sm:text-5xl">Rules for using Gihanga CLI and Upskillsafrica AI</h1>
      <p class="mt-4 max-w-3xl text-[#dce1fb]">These terms apply when you install Gihanga, use the console website, create an Upskillsafrica AI account, buy credits, or call AI models from the terminal.</p>
      <div class="mt-6 grid gap-3 text-sm sm:grid-cols-3"><div class="rounded-xl border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Last updated</p><p class="mt-1 font-bold text-gihanga-text">2026-07-17</p></div><div class="rounded-xl border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Product</p><p class="mt-1 font-bold text-gihanga-text">Gihanga CLI</p></div><div class="rounded-xl border border-white/10 bg-gihanga-deep p-4"><p class="font-mono text-[10px] uppercase tracking-[0.16em] text-gihanga-muted">Provider</p><p class="mt-1 font-bold text-gihanga-text">Upskillsafrica Foundation</p></div></div>
    </section>
    <section class="mt-6 grid gap-5 text-[#dce1fb] lg:grid-cols-3">
      <article data-reveal class="rounded-xl border border-emerald-400/20 bg-gihanga-emerald/10 p-6"><i data-lucide="check-circle-2" class="mb-4 h-8 w-8 text-gihanga-emerald"></i><h2 class="text-xl font-bold text-gihanga-text">Use it to build</h2><p class="mt-2">Gihanga is for lawful software development, learning, automation, documentation, debugging, and project assistance.</p></article>
      <article data-reveal class="rounded-xl border border-amber-400/20 bg-gihanga-amber/10 p-6"><i data-lucide="triangle-alert" class="mb-4 h-8 w-8 text-gihanga-amber"></i><h2 class="text-xl font-bold text-gihanga-text">You remain responsible</h2><p class="mt-2">Review generated code, commands, files, and recommendations before using them, especially in production systems.</p></article>
      <article data-reveal class="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-6"><i data-lucide="shield-ban" class="mb-4 h-8 w-8 text-gihanga-cyan"></i><h2 class="text-xl font-bold text-gihanga-text">Do not abuse access</h2><p class="mt-2">Do not use Gihanga for malware, phishing, credential theft, unauthorised access, spam, harassment, or illegal activity.</p></article>
    </section>
    <section class="mt-5 space-y-5 text-[#dce1fb]">
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="terminal" class="h-6 w-6 text-gihanga-emerald"></i> The service</h2><p class="mt-3">Gihanga provides a terminal AI coding assistant, install scripts, local skills and scripts, Upskillsafrica model access, account login, subscriptions, credits, and documentation. Features, model availability, quotas, and pricing may change as the service develops.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="user-round-check" class="h-6 w-6 text-gihanga-cyan"></i> Accounts and security</h2><p class="mt-3">You are responsible for your account, device, local tokens, and organisation codes. Keep credentials private and do not share access tokens. We may suspend access to protect users, the platform, providers, or payment systems.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="wallet-cards" class="h-6 w-6 text-gihanga-amber"></i> Credits, payments, and subscriptions</h2><p class="mt-3">Upskillsafrica model access may require active credits or an entitlement. Credits are granted after payment verification. Payment providers, network delays, expired sessions, or incorrect phone numbers can affect completion. If a payment is charged but access is not granted, contact support with the transaction reference.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="cpu" class="h-6 w-6 text-gihanga-emerald"></i> Models and organisation access</h2><p class="mt-3">Model names, quality, latency, context limits, quotas, and provider availability can change. Organisation-only models require an active organisation assignment or valid code and may be removed or restricted at any time.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="brain-circuit" class="h-6 w-6 text-gihanga-cyan"></i> AI output and commands</h2><p class="mt-3">AI output can be incorrect, incomplete, insecure, or unsuitable for your project. You are responsible for reviewing, testing, and approving code and commands. Do not run commands you do not understand.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="ban" class="h-6 w-6 text-gihanga-amber"></i> Acceptable use</h2><p class="mt-3">You may not use Gihanga to break laws, attack systems, evade security, steal credentials, create malware, spam people, violate privacy, infringe rights, or abuse provider/payment infrastructure. Upskillsafrica may limit or block usage that appears harmful or excessive.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="cloud-off" class="h-6 w-6 text-gihanga-cyan"></i> Availability and changes</h2><p class="mt-3">The service depends on internet access, payment providers, and AI providers. We do not guarantee uninterrupted access. We may update install scripts, pricing, docs, policies, or models as needed.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="flex items-center gap-3 text-2xl font-bold text-gihanga-text"><i data-lucide="scale" class="h-6 w-6 text-gihanga-emerald"></i> Liability</h2><p class="mt-3">To the fullest extent allowed by law, Gihanga and Upskillsafrica are provided without warranties. Upskillsafrica is not responsible for losses caused by unreviewed AI output, user-run commands, third-party provider outages, payment network delays, or misuse of the service.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Contact</h2><p class="mt-3">Questions about these terms can be sent through <a class="text-gihanga-emerald hover:text-[#68fcbf]" href="https://upskillsafrica.org">upskillsafrica.org</a>.</p></article>
    </section>
  </main>`
);

const CREDITS_HTML = `<!doctype html>
<html lang="rw">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Upskillsafrica AI Credits</title>
  <meta name="theme-color" content="#07111F" />
  <link rel="icon" href="${UPSKILLSAFRICA_FAVICON_SVG}" type="image/svg+xml" />
  <link rel="shortcut icon" href="${UPSKILLSAFRICA_FAVICON_ICO}" />
  <link rel="apple-touch-icon" href="${UPSKILLSAFRICA_APPLE_ICON}" />
  <link rel="manifest" href="/site.webmanifest" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={theme:{extend:{fontFamily:{sans:['Hanken Grotesk','ui-sans-serif','system-ui'],mono:['JetBrains Mono','ui-monospace']},colors:{gihanga:{bg:'#0c1324',deep:'#020617',glass:'rgba(15, 23, 42, 0.60)',emerald:'#34D399',cyan:'#22D3EE',amber:'#FBBF24',text:'#F1F5F9',muted:'#94A3B8'}}}}}</script>
  <style>
    html, body { width: 100%; max-width: 100%; overflow-x: hidden; }
    * { box-sizing: border-box; }
    main, section, div, footer, label { min-width: 0; }
    a, p, h1, h2, span, label { overflow-wrap: anywhere; }
    input, select, button { max-width: 100%; }
    pre { max-width: 100%; -webkit-overflow-scrolling: touch; }
    pre code { white-space: pre; }
    @media (max-width: 640px) {
      h1 { font-size: clamp(2rem, 11vw, 3rem) !important; line-height: 1.05 !important; }
      h2 { font-size: clamp(1.4rem, 7vw, 2rem) !important; line-height: 1.12 !important; }
      main, footer { padding-left: .875rem !important; padding-right: .875rem !important; }
      section { padding: 1rem !important; }
      pre { font-size: 11px !important; line-height: 1.65 !important; padding: 1rem !important; }
      button { width: 100%; }
    }
    @media (max-width: 380px) {
      main, footer { padding-left: .65rem !important; padding-right: .65rem !important; }
    }
  </style>
</head>
<body class="min-h-screen bg-gihanga-bg font-sans text-gihanga-text">
  <main class="mx-auto max-w-5xl px-6 py-8 sm:py-12">
    <a href="/" class="text-sm text-gihanga-emerald hover:text-[#68fcbf]">← Gihanga Console</a>
    <section class="mt-8 rounded-xl border border-white/10 bg-gihanga-glass p-6">
      <p class="text-sm uppercase tracking-[0.2em] text-gihanga-emerald">Upskillsafrica AI</p>
      <h1 class="mt-3 text-4xl font-black">Credits na Mobile Money</h1>
      <p class="mt-3 max-w-2xl text-[#dce1fb]">Pay through terminal or web, then use your receipt reference to check credits and model access.</p>
      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <label class="block"><span class="text-sm text-[#dce1fb]">Phone number</span><input id="phone" class="mt-2 w-full rounded-md border border-white/15 bg-gihanga-deep px-4 py-3" placeholder="078..." /></label>
        <label class="block"><span class="text-sm text-[#dce1fb]">Plan</span><select id="plan" class="mt-2 w-full rounded-md border border-white/15 bg-gihanga-deep px-4 py-3"></select></label>
      </div>
      <button id="pay" class="mt-5 rounded-md bg-gihanga-emerald px-5 py-3 font-bold text-[#003825] hover:bg-[#5af0b3] sm:w-auto">Start payment</button>
      <pre id="paymentResult" class="mt-5 overflow-x-auto rounded-md bg-gihanga-deep p-4 text-sm text-[#68fcbf]"></pre>
    </section>
    <section class="mt-6 rounded-xl border border-white/10 bg-gihanga-glass p-6">
      <h2 class="text-2xl font-bold">Check credits</h2>
      <div class="mt-4 flex flex-col gap-3 sm:flex-row"><input id="receipt" class="min-w-0 flex-1 rounded-md border border-white/15 bg-gihanga-deep px-4 py-3" placeholder="receipt / transaction ref" /><button id="check" class="rounded-md bg-cyan-300 px-5 py-3 font-bold text-[#003825] hover:bg-cyan-200 sm:w-auto">Check</button></div>
      <pre id="creditsResult" class="mt-5 overflow-x-auto rounded-md bg-gihanga-deep p-4 text-sm text-cyan-100"></pre>
    </section>
  </main>
  <footer class="mx-auto max-w-5xl px-6 py-8 text-sm text-slate-500">
    <div class="border-t border-white/10 pt-6">
      <a class="text-gihanga-emerald hover:text-[#68fcbf]" href="https://upskillsafrica.org" rel="noopener noreferrer">Powered by Upskillsafrica Foundation</a>
    </div>
  </footer>
<script>
const API = '/api';
const planSelect = document.getElementById('plan');
const paymentResult = document.getElementById('paymentResult');
const creditsResult = document.getElementById('creditsResult');
function show(el, value) { el.textContent = JSON.stringify(value, null, 2); }
async function loadPlans() {
  const data = await fetch(API + '/plans').then(r => r.json());
  for (const plan of data.plans || []) {
    const option = document.createElement('option');
    option.value = plan.id;
    option.textContent = plan.id + ' - ' + plan.amountRwf + ' RWF';
    planSelect.appendChild(option);
  }
}
document.getElementById('pay').addEventListener('click', async () => {
  const phone = document.getElementById('phone').value.trim();
  const plan = planSelect.value;
  const res = await fetch(API + '/terminal/pay', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, plan }) });
  show(paymentResult, await res.json());
});
document.getElementById('check').addEventListener('click', async () => {
  const receipt = document.getElementById('receipt').value.trim();
  const res = await fetch(API + '/credits/' + encodeURIComponent(receipt));
  show(creditsResult, await res.json());
});
loadPlans().catch(error => show(paymentResult, { error: String(error) }));
</script>
</body>
</html>`;

function withHeaders(body: BodyInit, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	headers.set("Cache-Control", "no-store");
	headers.set("X-Content-Type-Options", "nosniff");
	return new Response(body, { ...init, headers });
}

function isBrowserNavigation(request: Request): boolean {
	const accept = request.headers.get("Accept") || "";
	const userAgent = request.headers.get("User-Agent") || "";
	if (!accept.includes("text/html")) return false;
	return !/(curl|wget|powershell|pwsh|iwr|invoke-webrequest)/i.test(userAgent);
}

async function proxyApiRequest(request: Request, path: string): Promise<Response> {
	const upstreamUrl = `${UPSKILLSAFRICA_AI_SERVICE}${path}`;
	const headers = new Headers(request.headers);
	headers.delete("host");
	const upstream = await fetch(upstreamUrl, {
		method: request.method,
		headers,
		body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
	});
	const responseHeaders = new Headers(upstream.headers);
	responseHeaders.set("Cache-Control", "no-store");
	return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: responseHeaders });
}

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname === "/favicon.svg" || url.pathname === "/icon.svg") {
			return Response.redirect(UPSKILLSAFRICA_FAVICON_SVG, 302);
		}
		if (url.pathname === "/favicon.ico") {
			return Response.redirect(UPSKILLSAFRICA_FAVICON_ICO, 302);
		}
		if (url.pathname === "/site.webmanifest") {
			return withHeaders(SITE_WEBMANIFEST, {
				headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
			});
		}
		if (url.pathname === "/api/plans" && request.method === "GET") {
			return proxyApiRequest(request, "/plans");
		}
		if (url.pathname === "/api/terminal/pay" && request.method === "POST") {
			return proxyApiRequest(request, "/terminal/pay");
		}
		if (url.pathname.startsWith("/api/credits/") && request.method === "GET") {
			return proxyApiRequest(request, url.pathname.slice(4));
		}
		if (url.pathname === "/install.sh") {
			if (isBrowserNavigation(request)) return Response.redirect(`${url.origin}/#install`, 302);
			return withHeaders(SHELL_INSTALL_SCRIPT, {
				headers: { "Content-Type": "text/x-shellscript; charset=utf-8" },
			});
		}
		if (url.pathname === "/install.ps1") {
			if (isBrowserNavigation(request)) return Response.redirect(`${url.origin}/#install`, 302);
			return withHeaders(POWERSHELL_INSTALL_SCRIPT, {
				headers: { "Content-Type": "text/plain; charset=utf-8" },
			});
		}
		if (url.pathname === "/" || url.pathname === "/index.html") {
			return withHeaders(HOME_HTML, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		if (url.pathname === "/docs" || url.pathname === "/docs.html") {
			return withHeaders(DOCS_HTML, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		if (url.pathname === "/privacy" || url.pathname === "/privacy.html") {
			return withHeaders(PRIVACY_HTML, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		if (url.pathname === "/terms" || url.pathname === "/terms.html") {
			return withHeaders(TERMS_HTML, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		if (url.pathname === "/credits" || url.pathname === "/credits.html") {
			return withHeaders(CREDITS_HTML, {
				headers: { "Content-Type": "text/html; charset=utf-8" },
			});
		}
		return withHeaders("Not found\n", {
			status: 404,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	},
};
