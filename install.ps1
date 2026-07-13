$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$RepoUrl = "https://github.com/DannyIRUMVA/gihanga-command-line-interface.git"
$InstallDir = if ($env:GIHANGA_INSTALL_DIR) { $env:GIHANGA_INSTALL_DIR } else { Join-Path $HOME ".gihanga-cli" }
$InstallLog = if ($env:GIHANGA_INSTALL_LOG) { $env:GIHANGA_INSTALL_LOG } else { Join-Path ([IO.Path]::GetTempPath()) "gihanga-install.log" }
Set-Content -Path $InstallLog -Value ""

function Invoke-Quiet($Label, [ScriptBlock]$Command) {
	Write-Host $Label
	try {
		& $Command *> $InstallLog
	} catch {
		Write-Error "${Label} failed. Log: $InstallLog"
		if (Test-Path -LiteralPath $InstallLog) { Get-Content -Tail 40 $InstallLog | Write-Error }
		throw
	}
	if ($LASTEXITCODE -ne 0) {
		Write-Error "${Label} failed. Log: $InstallLog"
		if (Test-Path -LiteralPath $InstallLog) { Get-Content -Tail 40 $InstallLog | Write-Error }
		exit $LASTEXITCODE
	}
}

function Require-Command($Name) {
	if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
		throw "'$Name' irakenewe ariko ntiyabonetse. Banza winjize Git, Node.js, na npm, hanyuma wongere ukoreshe iyi script."
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
