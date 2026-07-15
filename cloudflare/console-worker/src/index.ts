const REPO_URL = "https://github.com/DannyIRUMVA/gihanga-command-line-interface.git";

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

if [ -d "$INSTALL_DIR/.git" ]; then
	run_quiet "Kuvugurura Gihanga..." git -C "$INSTALL_DIR" pull --ff-only --quiet
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
run_quiet_shell "Gushyira Gihanga muri terminal..." "cd packages/coding-agent && npm link --silent"

GIHANGA_AGENT_DIR="\${GIHANGA_AGENT_DIR:-$HOME/.gihanga/agent}"
mkdir -p "$GIHANGA_AGENT_DIR/skills" "$GIHANGA_AGENT_DIR/data" "$GIHANGA_AGENT_DIR/scripts"
cp -R "$INSTALL_DIR/resources/gihanga/agent/skills/gihanga-community" "$GIHANGA_AGENT_DIR/skills/"
cp "$INSTALL_DIR"/resources/gihanga/agent/data/* "$GIHANGA_AGENT_DIR/data/"
if [ -f "$INSTALL_DIR/resources/gihanga/agent/models.json" ]; then
	cp "$INSTALL_DIR/resources/gihanga/agent/models.json" "$GIHANGA_AGENT_DIR/models.json"
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
echo "Run: gihanga --help"
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
	Copy-Item -Force $ModelsJson (Join-Path $GihangaAgentDir "models.json")
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
  <header class="relative mx-auto flex w-[90%] max-w-[1200px] items-center justify-between px-0 py-5">
    <a href="/" class="flex items-center gap-3">
      <span class="grid h-11 w-11 place-items-center rounded-lg bg-gihanga-emerald text-[#003825] shadow-glow">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"></path>
          <path d="M12 8v8"></path>
          <path d="m8.5 10 3.5-2 3.5 2"></path>
        </svg>
      </span>
      <div>
        <p class="text-lg font-black tracking-tight">Gihanga CLI <span class="ml-2 rounded-md border border-gihanga-emerald/30 bg-gihanga-emerald/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-gihanga-emerald">Alpha</span></p>
        <p class="text-xs text-gihanga-muted">Kinyarwanda-first terminal AI · v0.1.0-alpha.2</p>
      </div>
    </a>
    <nav class="hidden items-center gap-5 text-sm text-[#dce1fb] md:flex">
      <a class="hover:text-gihanga-text" href="/#install">Install</a>
      <a class="hover:text-gihanga-text" href="/docs">Docs</a>
      <a class="hover:text-gihanga-text" href="/privacy">Privacy</a>
      <a class="hover:text-gihanga-text" href="/terms">Terms</a>
    </nav>
  </header>`;

const SITE_FOOTER = `
  <footer class="relative mx-auto w-[90%] max-w-[1200px] px-0 py-10 text-sm text-slate-500">
    <div class="flex flex-col justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
      <p>Gihanga CLI - Kinyarwanda-first terminal AI coding assistant · Alpha v0.1.0-alpha.2</p>
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
    body { background: #0c1324; }
    .neo-grid { background-image: radial-gradient(circle at 1px 1px, rgba(148,163,184,.10) 1px, transparent 0); background-size: 32px 32px; }
    [data-reveal] { opacity: 0; transform: translateY(22px); transition: opacity 700ms ease, transform 700ms ease; }
    [data-reveal].is-visible { opacity: 1; transform: translateY(0); }
    [data-reveal="terminal"] { transform: translateY(14px) scale(.985); }
    [data-reveal="terminal"].is-visible { transform: translateY(0) scale(1); }
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
	"Gihanga CLI ni umufasha wa AI mu kwandika kode muri terminal, ushyira Ikinyarwanda imbere.",
	`
  <main class="relative">
    <section data-reveal="terminal" class="mx-auto w-[90%] max-w-[1200px] py-10 lg:py-16">
      <div class="rounded-xl border border-white/10 bg-gihanga-glass p-4 shadow-2xl shadow-emerald-950/20 backdrop-blur">
        <div class="mb-3 flex items-center justify-between gap-3 px-2">
          <div class="flex items-center gap-2"><span class="h-3 w-3 rounded-full bg-red-400"></span><span class="h-3 w-3 rounded-full bg-gihanga-amber"></span><span class="h-3 w-3 rounded-full bg-gihanga-emerald"></span><span class="ml-3 font-mono text-xs text-gihanga-muted">gihanga-terminal</span></div>
          <span class="hidden font-mono text-xs uppercase tracking-[0.1em] text-gihanga-emerald sm:inline">Kinyarwanda-first AI coding</span>
        </div>
        <pre class="font-mono overflow-x-auto rounded-lg bg-gihanga-deep p-5 text-sm leading-7 text-slate-200 sm:p-7"><code>$ curl -fsSL https://console.upskillsafrica.org/install.sh | bash
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

╭─ Gihanga kumurimo · ~/Projects/app                  Kode mbi ni nka brochette idahiye: igora kuyihekenya
╰─ o3 · medium · 1.3%/200k · ↑2.6k ↓51 · 0 RWF        Kigali 22°C 🌤

/kwinjira    injira muri Upskillsafrica
/ubumenyi    koresha ubumenyi bwa project
/sohoka      sohoka muri Gihanga</code></pre>
        <div class="mt-4 flex flex-col gap-3 sm:flex-row">
          <a href="#install" class="inline-flex items-center justify-center gap-2 rounded-lg bg-gihanga-emerald px-5 py-3 font-bold text-[#003825] shadow-glow transition hover:bg-[#5af0b3]">Tangira install <i data-lucide="arrow-right" class="h-5 w-5"></i></a>
          <a href="/docs" class="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-3 font-bold text-gihanga-text transition hover:bg-white/10">Soma docs</a>
        </div>
      </div>
    </section>

    <section data-reveal id="install" class="mx-auto w-[90%] max-w-[1200px] py-8">
      <div class="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-emerald">Install</p>
          <h2 class="mt-2 text-3xl font-black text-gihanga-text sm:text-4xl">Install kuri OS yawe</h2>
          <p class="mt-2 text-gihanga-muted">Installer ishyiraho CLI, ubumenyi bwa Gihanga, scripts, na curated Upskillsafrica model config.</p>
        </div>
        <a href="/docs#subscription" class="text-sm font-semibold text-gihanga-emerald hover:text-[#68fcbf]">Reba subscription flow →</a>
      </div>
      <div class="grid gap-5 lg:grid-cols-2">
        <article class="rounded-xl border border-white/10 bg-gihanga-glass p-6 backdrop-blur">
          <div class="mb-4 flex items-center gap-3"><span class="grid h-12 w-12 place-items-center rounded-lg bg-cyan-400/15 text-[#a2eeff]"><i data-lucide="monitor" class="h-6 w-6"></i></span><div><h3 class="text-xl font-bold text-gihanga-text">🐧 🍎 Linux / macOS</h3><p class="text-sm text-gihanga-muted">Bash installer</p></div></div>
          <pre class="font-mono overflow-x-auto rounded-lg border border-white/10 bg-gihanga-deep p-4 text-sm text-[#68fcbf]"><code>curl -fsSL https://console.upskillsafrica.org/install.sh | bash</code></pre>
        </article>
        <article class="rounded-xl border border-white/10 bg-gihanga-glass p-6 backdrop-blur">
          <div class="mb-4 flex items-center gap-3"><span class="grid h-12 w-12 place-items-center rounded-lg bg-blue-400/15 text-blue-200"><i data-lucide="panel-top" class="h-6 w-6"></i></span><div><h3 class="text-xl font-bold text-gihanga-text">🪟 Windows PowerShell</h3><p class="text-sm text-gihanga-muted">Native Windows installer</p></div></div>
          <pre class="font-mono overflow-x-auto rounded-lg border border-white/10 bg-gihanga-deep p-4 text-sm text-[#68fcbf]"><code>iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex</code></pre>
        </article>
      </div>
    </section>

    <section data-reveal class="mx-auto grid w-[90%] max-w-[1200px] gap-5 py-10 lg:grid-cols-3">
      <article data-reveal class="rounded-xl border border-emerald-400/20 bg-gihanga-emerald/10 p-6"><i data-lucide="languages" class="mb-4 h-8 w-8 text-gihanga-emerald"></i><h3 class="text-xl font-bold text-gihanga-text">Kinyarwanda-first</h3><p class="mt-2 text-[#dce1fb]">Default responses in Kinyarwanda unless English is requested. Commands like /kwinjira and /sohoka fit local workflow.</p></article>
      <article data-reveal class="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-6"><i data-lucide="brain-circuit" class="mb-4 h-8 w-8 text-gihanga-cyan"></i><h3 class="text-xl font-bold text-gihanga-text">Ubumenyi</h3><p class="mt-2 text-[#dce1fb]">Bundled Gihanga community guidance, Cloudflare skills, and project knowledge loaded into terminal workflows.</p></article>
      <article data-reveal class="rounded-xl border border-amber-400/20 bg-gihanga-amber/10 p-6"><i data-lucide="wallet-cards" class="mb-4 h-8 w-8 text-gihanga-amber"></i><h3 class="text-xl font-bold text-gihanga-text">Mobile Money credits</h3><p class="mt-2 text-[#dce1fb]">Users choose a plan, enter phone number, confirm on phone, then Gihanga unlocks models automatically.</p></article>
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
          <p class="mt-4 text-[#dce1fb]">TUI yerekana 12 curated models muri provider ya <code>upskillsafrica</code>. Public UI ntigaragaza OpenRouter/Azure internals. Organisation models <code>UAF_model_one</code> na <code>uaf_model_two_alpha</code> zisaba organisation code.</p>
        </article>

        <article data-reveal id="providers" class="rounded-xl border border-white/10 bg-gihanga-glass p-6">
          <div class="flex items-start gap-4"><span class="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-gihanga-amber/10 text-gihanga-amber"><i data-lucide="key-round" class="h-6 w-6"></i></span><div><p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-amber">Optional</p><h2 class="text-2xl font-bold text-gihanga-text">Add another provider with an API key</h2></div></div>
          <p class="mt-4 text-[#dce1fb]">Upskillsafrica is the recommended default, but Gihanga can also use your own provider API key. Use this if you already have OpenRouter, Anthropic, OpenAI, Gemini, or another supported provider account.</p>
          <div class="mt-4 grid gap-4 lg:grid-cols-2">
            <div class="rounded-lg border border-white/10 bg-gihanga-deep p-4">
              <p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-muted">TUI flow</p>
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
          <div class="mt-4 grid gap-3 font-mono text-sm text-[#68fcbf] md:grid-cols-3"><code class="rounded-lg bg-gihanga-deep p-3">ubumenyi:gihanga-community</code><code class="rounded-lg bg-gihanga-deep p-3">ubumenyi:agents-sdk</code><code class="rounded-lg bg-gihanga-deep p-3">ubumenyi:cloudflare</code></div>
          <p class="mt-4 text-[#dce1fb]">Ubumenyi bufasha Gihanga gukurikiza Kinyarwanda-first coding, Cloudflare Workers guidance, n'ibisabwa na community.</p>
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
	"Privacy Policy for Gihanga CLI and Upskillsafrica AI subscription services.",
	`
  <main data-reveal class="relative mx-auto w-[90%] max-w-[1200px] py-8">
    <section class="rounded-2xl border border-white/10 bg-gihanga-glass p-8 backdrop-blur">
      <p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-emerald">Privacy Policy</p>
      <h1 class="mt-3 text-4xl font-black text-gihanga-text">Gihanga Privacy Policy</h1>
      <p class="mt-3 text-gihanga-muted">Effective date: 2026-07-13</p>
    </section>
    <section class="mt-6 space-y-5 text-[#dce1fb]">
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Data we process</h2><p class="mt-3">Gihanga may process account email, hashed password, session metadata, Mobile Money phone number for payment initiation, transaction reference, entitlement/credit status, model usage totals, and technical request metadata needed to operate the service.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Local data</h2><p class="mt-3">The CLI stores local configuration, model catalog, skills, scripts, and login token under <code>~/.gihanga/agent</code>. Users can remove this directory to clear local Gihanga data.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Payments</h2><p class="mt-3">When you enter a Mobile Money number, Gihanga sends it to the Upskillsafrica AI backend and payment worker to start and verify payment. We use payment data to grant credits and handle support.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">AI requests</h2><p class="mt-3">Prompts, code snippets, files, and tool context sent from the CLI may be processed by configured AI providers through Upskillsafrica routing. Do not submit secrets or information you are not allowed to share.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Retention and security</h2><p class="mt-3">Passwords are hashed, sessions can be revoked, and entitlements/usage are stored to enforce subscriptions and quotas. We keep operational records only as needed for service, security, accounting, and support.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Contact</h2><p class="mt-3">For privacy requests, contact Upskillsafrica Foundation through <a class="text-gihanga-emerald hover:text-[#68fcbf]" href="https://upskillsafrica.org">upskillsafrica.org</a>.</p></article>
    </section>
  </main>`
);

const TERMS_HTML = pageShell(
	"Gihanga Terms of Service",
	"Terms of Service for using Gihanga CLI and Upskillsafrica AI models.",
	`
  <main data-reveal class="relative mx-auto w-[90%] max-w-[1200px] py-8">
    <section class="rounded-2xl border border-white/10 bg-gihanga-glass p-8 backdrop-blur">
      <p class="font-mono text-xs font-bold uppercase tracking-[0.1em] text-gihanga-emerald">Terms of Service</p>
      <h1 class="mt-3 text-4xl font-black text-gihanga-text">Gihanga Terms of Service</h1>
      <p class="mt-3 text-gihanga-muted">Effective date: 2026-07-13</p>
    </section>
    <section class="mt-6 space-y-5 text-[#dce1fb]">
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Use of service</h2><p class="mt-3">Gihanga is a coding assistant for lawful development, learning, automation, and project work. You are responsible for the code, commands, files, and prompts you submit or execute.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Accounts and subscriptions</h2><p class="mt-3">Access to Upskillsafrica models may require registration, login, and active credits. Mobile Money payments unlock entitlements according to the selected plan. Organisation-only models require a valid organisation code.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Acceptable use</h2><p class="mt-3">Do not use Gihanga for illegal activity, credential theft, unauthorized access, spam, malware, or abuse of third-party systems. Respect provider policies and local laws.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">AI output</h2><p class="mt-3">AI output can be wrong. Review code, run tests, and verify changes before using them in production. Gihanga may execute commands only when you choose to run or approve them.</p></article>
      <article data-reveal class="rounded-xl border border-white/10 bg-gihanga-glass p-6"><h2 class="text-2xl font-bold text-gihanga-text">Availability</h2><p class="mt-3">The service depends on network access, Cloudflare Workers, payment providers, databases, and AI providers. Availability, latency, models, quotas, and pricing may change.</p></article>
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config={theme:{extend:{fontFamily:{sans:['Hanken Grotesk','ui-sans-serif','system-ui'],mono:['JetBrains Mono','ui-monospace']},colors:{gihanga:{bg:'#0c1324',deep:'#020617',glass:'rgba(15, 23, 42, 0.60)',emerald:'#34D399',cyan:'#22D3EE',amber:'#FBBF24',text:'#F1F5F9',muted:'#94A3B8'}}}}}</script>
</head>
<body class="min-h-screen bg-gihanga-bg font-sans text-gihanga-text">
  <main class="mx-auto max-w-5xl px-6 py-12">
    <a href="/" class="text-sm text-gihanga-emerald hover:text-[#68fcbf]">← Gihanga Console</a>
    <section class="mt-8 rounded-xl border border-white/10 bg-gihanga-glass p-6">
      <p class="text-sm uppercase tracking-[0.2em] text-gihanga-emerald">Upskillsafrica AI</p>
      <h1 class="mt-3 text-4xl font-black">Credits na Mobile Money</h1>
      <p class="mt-3 max-w-2xl text-[#dce1fb]">Pay through terminal or web, then use your receipt reference to check credits and model access.</p>
      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <label class="block"><span class="text-sm text-[#dce1fb]">Phone number</span><input id="phone" class="mt-2 w-full rounded-md border border-white/15 bg-gihanga-deep px-4 py-3" placeholder="078..." /></label>
        <label class="block"><span class="text-sm text-[#dce1fb]">Plan</span><select id="plan" class="mt-2 w-full rounded-md border border-white/15 bg-gihanga-deep px-4 py-3"></select></label>
      </div>
      <button id="pay" class="mt-5 rounded-md bg-gihanga-emerald px-5 py-3 font-bold text-[#003825] hover:bg-[#5af0b3]">Start payment</button>
      <pre id="paymentResult" class="mt-5 overflow-x-auto rounded-md bg-gihanga-deep p-4 text-sm text-[#68fcbf]"></pre>
    </section>
    <section class="mt-6 rounded-xl border border-white/10 bg-gihanga-glass p-6">
      <h2 class="text-2xl font-bold">Check credits</h2>
      <div class="mt-4 flex flex-col gap-3 sm:flex-row"><input id="receipt" class="flex-1 rounded-md border border-white/15 bg-gihanga-deep px-4 py-3" placeholder="receipt / transaction ref" /><button id="check" class="rounded-md bg-cyan-300 px-5 py-3 font-bold text-[#003825] hover:bg-cyan-200">Check</button></div>
      <pre id="creditsResult" class="mt-5 overflow-x-auto rounded-md bg-gihanga-deep p-4 text-sm text-cyan-100"></pre>
    </section>
  </main>
  <footer class="mx-auto max-w-5xl px-6 py-8 text-sm text-slate-500">
    <div class="border-t border-white/10 pt-6">
      <a class="text-gihanga-emerald hover:text-[#68fcbf]" href="https://upskillsafrica.org" rel="noopener noreferrer">Powered by Upskillsafrica Foundation</a>
    </div>
  </footer>
<script>
const API = 'https://upskillsafrica-ai-backend.boyg87059.workers.dev';
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
	headers.set("Cache-Control", "public, max-age=300");
	headers.set("X-Content-Type-Options", "nosniff");
	return new Response(body, { ...init, headers });
}

function isBrowserNavigation(request: Request): boolean {
	const accept = request.headers.get("Accept") || "";
	const userAgent = request.headers.get("User-Agent") || "";
	if (!accept.includes("text/html")) return false;
	return !/(curl|wget|powershell|pwsh|iwr|invoke-webrequest)/i.test(userAgent);
}

export default {
	fetch(request: Request): Response {
		const url = new URL(request.url);
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
