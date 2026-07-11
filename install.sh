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
	echo "Kuvugurura Gihanga CLI muri $INSTALL_DIR"
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

GIHANGA_AGENT_DIR="${GIHANGA_AGENT_DIR:-$HOME/.gihanga/agent}"
mkdir -p "$GIHANGA_AGENT_DIR/skills" "$GIHANGA_AGENT_DIR/data"
cp -R "$INSTALL_DIR/resources/gihanga/agent/skills/gihanga-community" "$GIHANGA_AGENT_DIR/skills/"
cp "$INSTALL_DIR/resources/gihanga/agent/data/kinyarwanda-keywords.json" "$GIHANGA_AGENT_DIR/data/kinyarwanda-keywords.json"

echo ""
echo "Gihanga CLI installed successfully."
echo "Kinyarwanda keyword data installed in: $GIHANGA_AGENT_DIR"
echo "Run: gihanga --help"
