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
	echo "Kuvugurura Gihanga..."
	git -C "$INSTALL_DIR" pull --ff-only --quiet
elif [ -e "$INSTALL_DIR" ]; then
	echo "Error: $INSTALL_DIR exists but is not a git repository." >&2
	echo "Set GIHANGA_INSTALL_DIR to another path or remove that folder." >&2
	exit 1
else
	echo "Kwinjiza Gihanga..."
	git clone --quiet "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"
echo "Gutegura amapakeji..."
npm install --ignore-scripts --silent --no-fund --no-audit --loglevel=error
echo "Kubaka Gihanga..."
npm run build --silent
(cd packages/coding-agent && npm link --silent)

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

function Require-Command($Name) {
	if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
		throw "'$Name' is required but was not found. Install Git, Node.js, and npm, then run this script again."
	}
}

Require-Command git
Require-Command node
Require-Command npm

if (Test-Path -LiteralPath (Join-Path $InstallDir ".git")) {
	Write-Host "Kuvugurura Gihanga..."
	git -C $InstallDir pull --ff-only --quiet
} elseif (Test-Path -LiteralPath $InstallDir) {
	throw "$InstallDir exists but is not a git repository. Set GIHANGA_INSTALL_DIR to another path or remove that folder."
} else {
	Write-Host "Kwinjiza Gihanga..."
	git clone --quiet $RepoUrl $InstallDir
}

Set-Location $InstallDir
Write-Host "Gutegura amapakeji..."
npm install --ignore-scripts --silent --no-fund --no-audit --loglevel=error
Write-Host "Kubaka Gihanga..."
npm run build --silent
Push-Location "packages/coding-agent"
npm link --silent
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

const HOME_HTML = `<!doctype html>
<html lang="rw" class="scroll-smooth">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Gihanga CLI ni umufasha wa AI mu kwandika kode muri terminal, ushyira Ikinyarwanda imbere." />
  <title>Gihanga CLI - Kinyarwanda-first AI coding assistant</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide@latest"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            gihanga: {
              ink: '#07111f',
              green: '#22c55e',
              cyan: '#22d3ee',
              gold: '#fbbf24'
            }
          },
          boxShadow: {
            glow: '0 0 80px rgba(34, 197, 94, 0.22)'
          }
        }
      }
    };
  </script>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100 antialiased">
  <div class="pointer-events-none fixed inset-0 overflow-hidden">
    <div class="absolute left-1/2 top-0 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl"></div>
    <div class="absolute right-0 top-48 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl"></div>
    <div class="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl"></div>
  </div>

  <header class="relative mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
    <a href="/" class="flex items-center gap-3">
      <span class="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400 text-slate-950 shadow-glow">
        <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Z"></path>
          <path d="M12 8v8"></path>
          <path d="m8.5 10 3.5-2 3.5 2"></path>
        </svg>
      </span>
      <div>
        <p class="text-lg font-bold tracking-tight">Gihanga CLI</p>
        <p class="text-xs text-slate-400">Kinyarwanda-first terminal AI</p>
      </div>
    </a>
    <nav class="hidden items-center gap-6 text-sm text-slate-300 md:flex">
      <a class="hover:text-white" href="#install">Install</a>
      <a class="hover:text-white" href="#features">Ibyo ikora</a>
      <a class="hover:text-white" href="${REPO_URL.replace(".git", "")}">GitHub</a>
    </nav>
  </header>

  <main class="relative">
    <section class="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-24">
      <div>
        <div class="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
          <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5"></path>
          </svg>
          Ikoreshwa kuri Linux, macOS na Windows
        </div>
        <h1 class="max-w-4xl text-5xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl">
          Andika kode muri terminal ukoresheje <span class="bg-gradient-to-r from-emerald-300 via-cyan-300 to-amber-200 bg-clip-text text-transparent">Gihanga CLI</span>.
        </h1>
        <p class="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Umufasha wa AI wubakiwe developers bakoresha Ikinyarwanda: gusoma kode, kuyisobanura, kuyihindura, gukoresha bash, no gukomeza ibiganiro byawe muri terminal.
        </p>
        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <a href="#install" class="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-6 py-3 font-semibold text-slate-950 shadow-glow transition hover:bg-emerald-300">
            Tangira install
            <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>
            </svg>
          </a>
          <a href="${REPO_URL.replace(".git", "")}" class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-white/5 px-6 py-3 font-semibold text-white transition hover:bg-white/10">
            Reba kuri GitHub
          </a>
        </div>
      </div>

      <div class="rounded-3xl border border-white/10 bg-slate-900/70 p-4 shadow-2xl backdrop-blur">
        <div class="mb-3 flex items-center gap-2 px-2">
          <span class="h-3 w-3 rounded-full bg-red-400"></span>
          <span class="h-3 w-3 rounded-full bg-amber-400"></span>
          <span class="h-3 w-3 rounded-full bg-emerald-400"></span>
          <span class="ml-3 text-xs text-slate-400">terminal</span>
        </div>
        <pre class="overflow-x-auto rounded-2xl bg-slate-950 p-6 text-sm leading-7 text-slate-200"><code>$ gihanga

/settings    igenamiterere
/kwinjira    login ya provider
/continue    komeza ikiganiro
/sohoka      sohoka muri Gihanga

AI: Reka dusome iyi poroje...</code></pre>
      </div>
    </section>

    <section id="install" class="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <div class="mb-8 flex items-end justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-widest text-emerald-300">Install</p>
          <h2 class="mt-2 text-3xl font-black text-white sm:text-4xl">Install kuri OS yawe</h2>
        </div>
      </div>
      <div class="grid gap-5 lg:grid-cols-2">
        <article class="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div class="mb-4 flex items-center gap-3">
            <span class="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-400/15 text-cyan-200">
              <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="14" rx="2"></rect><path d="M8 21h8"></path><path d="M12 18v3"></path>
              </svg>
            </span>
            <div>
              <h3 class="text-xl font-bold text-white">🐧 🍎 Linux / macOS</h3>
              <p class="text-sm text-slate-400">Bash installer</p>
            </div>
          </div>
          <pre class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-emerald-200"><code>curl -fsSL https://console.upskillsafrica.org/install.sh | bash</code></pre>
        </article>

        <article class="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
          <div class="mb-4 flex items-center gap-3">
            <span class="grid h-12 w-12 place-items-center rounded-2xl bg-blue-400/15 text-blue-200">
              <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 5.5 10 4v7H3V5.5Z"></path><path d="M12 3.5 21 2v9h-9V3.5Z"></path><path d="M3 13h7v7l-7-1.5V13Z"></path><path d="M12 13h9v9l-9-1.5V13Z"></path>
              </svg>
            </span>
            <div>
              <h3 class="text-xl font-bold text-white">🪟 Windows PowerShell</h3>
              <p class="text-sm text-slate-400">Native Windows installer</p>
            </div>
          </div>
          <pre class="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-emerald-200"><code>iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex</code></pre>
        </article>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <div class="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-8 backdrop-blur">
        <div class="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p class="text-sm font-semibold uppercase tracking-widest text-emerald-300">Kinyarwanda data</p>
            <h2 class="mt-2 text-3xl font-black text-white sm:text-4xl">Install izana ubumenyi bwa Gihanga.</h2>
            <p class="mt-4 text-slate-300">Gihanga ishyiramo glossary ya Kinyarwanda muri <code class="rounded bg-slate-950 px-2 py-1 text-emerald-200">~/.gihanga/agent</code>: amagambo ya ICT, coding actions, slash commands, n'amagambo asanzwe yo gufasha AI gusobanura neza mu Kinyarwanda.</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div class="mb-2 flex items-center gap-2 text-emerald-200"><i data-lucide="brain-circuit" class="h-5 w-5"></i><span class="font-semibold">ubwenge buhangano</span></div>
              <p class="text-sm text-slate-400">AI terminology na technology words.</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div class="mb-2 flex items-center gap-2 text-cyan-200"><i data-lucide="terminal-square" class="h-5 w-5"></i><span class="font-semibold">andika / soma</span></div>
              <p class="text-sm text-slate-400">Coding verbs n'ibikorwa bya terminal.</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div class="mb-2 flex items-center gap-2 text-amber-200"><i data-lucide="book-open-text" class="h-5 w-5"></i><span class="font-semibold">ijambo / igikoresho</span></div>
              <p class="text-sm text-slate-400">Common vocabulary ikoreshwa mu bisobanuro.</p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <div class="mb-2 flex items-center gap-2 text-violet-200"><i data-lucide="sparkles" class="h-5 w-5"></i><span class="font-semibold">kwinjira / sohoka</span></div>
              <p class="text-sm text-slate-400">Slash commands zashyizwe mu Kinyarwanda.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="features" class="mx-auto grid max-w-7xl gap-5 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
      <article class="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <svg viewBox="0 0 24 24" class="mb-4 h-8 w-8 text-emerald-300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"></path><path d="M4 12h16"></path><path d="M4 17h10"></path></svg>
        <h3 class="font-bold text-white">Soma kode</h3>
        <p class="mt-2 text-sm text-slate-400">Sobanukirwa files na project structure vuba.</p>
      </article>
      <article class="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <svg viewBox="0 0 24 24" class="mb-4 h-8 w-8 text-cyan-300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 20 9-16"></path><path d="m3 4 9 16"></path><path d="M7 12h10"></path></svg>
        <h3 class="font-bold text-white">Hindura kode</h3>
        <p class="mt-2 text-sm text-slate-400">Edits zikorwa muri repo yawe, zigenzurwa na checks.</p>
      </article>
      <article class="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <svg viewBox="0 0 24 24" class="mb-4 h-8 w-8 text-amber-300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 6-6-6-6"></path><path d="M12 19h8"></path></svg>
        <h3 class="font-bold text-white">Koresha terminal</h3>
        <p class="mt-2 text-sm text-slate-400">Run commands, tests, builds, na scripts.</p>
      </article>
      <article class="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
        <svg viewBox="0 0 24 24" class="mb-4 h-8 w-8 text-violet-300" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="m5 5 14 14"></path><path d="m19 5-14 14"></path></svg>
        <h3 class="font-bold text-white">Kinyarwanda-first</h3>
        <p class="mt-2 text-sm text-slate-400">Slash commands nka /kwinjira, /continue, /sohoka.</p>
      </article>
    </section>
  </main>

  <footer class="relative mx-auto max-w-7xl px-6 py-10 text-sm text-slate-500 lg:px-8">
    <div class="flex flex-col justify-between gap-4 border-t border-white/10 pt-6 sm:flex-row">
      <p>Gihanga CLI - Upskillsafrica console.</p>
      <a class="text-slate-300 hover:text-white" href="${REPO_URL.replace(".git", "")}">GitHub repository</a>
    </div>
  </footer>
  <script>
    lucide.createIcons();
  </script>
</body>
</html>`;

const CREDITS_HTML = `<!doctype html>
<html lang="rw">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Upskillsafrica AI Credits</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-950 text-slate-100">
  <main class="mx-auto max-w-5xl px-6 py-12">
    <a href="/" class="text-sm text-emerald-300 hover:text-emerald-200">← Gihanga Console</a>
    <section class="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <p class="text-sm uppercase tracking-[0.2em] text-emerald-300">Upskillsafrica AI</p>
      <h1 class="mt-3 text-4xl font-black">Credits na Mobile Money</h1>
      <p class="mt-3 max-w-2xl text-slate-300">Pay through terminal or web, then use your receipt reference to check credits and model access.</p>
      <div class="mt-8 grid gap-4 md:grid-cols-2">
        <label class="block"><span class="text-sm text-slate-300">Phone number</span><input id="phone" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="078..." /></label>
        <label class="block"><span class="text-sm text-slate-300">Plan</span><select id="plan" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"></select></label>
      </div>
      <button id="pay" class="mt-5 rounded-xl bg-emerald-400 px-5 py-3 font-bold text-slate-950 hover:bg-emerald-300">Start payment</button>
      <pre id="paymentResult" class="mt-5 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-emerald-200"></pre>
    </section>
    <section class="mt-6 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
      <h2 class="text-2xl font-bold">Check credits</h2>
      <div class="mt-4 flex flex-col gap-3 sm:flex-row"><input id="receipt" class="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" placeholder="receipt / transaction ref" /><button id="check" class="rounded-xl bg-cyan-300 px-5 py-3 font-bold text-slate-950 hover:bg-cyan-200">Check</button></div>
      <pre id="creditsResult" class="mt-5 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-cyan-100"></pre>
    </section>
  </main>
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
