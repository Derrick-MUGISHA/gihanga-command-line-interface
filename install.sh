#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/DannyIRUMVA/gihanga-command-line-interface.git"
INSTALL_DIR="${GIHANGA_INSTALL_DIR:-$HOME/.gihanga-cli}"

require_command() {
	if ! command -v "$1" >/dev/null 2>&1; then
		echo "Error: '$1' irakenewe ariko ntiyabonetse." >&2
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

GIHANGA_AGENT_DIR="${GIHANGA_AGENT_DIR:-$HOME/.gihanga/agent}"
mkdir -p "$GIHANGA_AGENT_DIR/skills" "$GIHANGA_AGENT_DIR/data" "$GIHANGA_AGENT_DIR/scripts"
cp -R "$INSTALL_DIR/resources/gihanga/agent/skills/gihanga-community" "$GIHANGA_AGENT_DIR/skills/"
cp "$INSTALL_DIR"/resources/gihanga/agent/data/* "$GIHANGA_AGENT_DIR/data/"
cp "$INSTALL_DIR"/resources/gihanga/agent/scripts/* "$GIHANGA_AGENT_DIR/scripts/"

if [ "${GIHANGA_INSTALL_MBAZA_NLP:-0}" = "1" ] || [ "${GIHANGA_INSTALL_MBAZA_NLP:-}" = "true" ]; then
	MBAZA_ARGS=(--dataset "${GIHANGA_MBAZA_NLP_DATASET:-mbazaNLP/kinyarwanda_monolingual_v01.0}")
	if [ "${GIHANGA_MBAZA_METADATA_ONLY:-0}" = "1" ] || [ "${GIHANGA_MBAZA_METADATA_ONLY:-}" = "true" ]; then
		MBAZA_ARGS+=(--metadata-only)
	fi
	node "$GIHANGA_AGENT_DIR/scripts/import-mbaza-nlp.mjs" "${MBAZA_ARGS[@]}"
fi

if [ -n "${AZURE_OPENAI_API_KEY:-}" ] && { [ -n "${AZURE_OPENAI_BASE_URL:-}" ] || [ -n "${AZURE_OPENAI_RESOURCE_NAME:-}" ]; }; then
	AUTH_PATH="$GIHANGA_AGENT_DIR/auth.json" node <<'JS'
const fs = require("fs");
const path = process.env.AUTH_PATH;
const baseFromResource = (name) => `https://${name}.openai.azure.com`;
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
