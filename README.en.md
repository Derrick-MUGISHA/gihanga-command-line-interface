# Gihanga CLI

Gihanga CLI is a Kinyarwanda-first AI coding assistant for the terminal. It helps developers read, edit, write, and run code from the command line while keeping the familiar workflow of a coding agent.

Website: https://console.upskillsafrica.org

> Default documentation is Kinyarwanda-first: [README.md](README.md)

## What it does

- Opens an interactive terminal coding assistant with `gihanga`
- Reads project files and explains code
- Edits and writes files when you ask it to
- Runs shell commands through the built-in bash tool
- Supports multiple AI providers and models
- Supports ubumenyi, extensions, prompt templates, and themes
- Shows Kinyarwanda-first CLI help and slash-command descriptions

## Requirements

- Linux, macOS, or Windows terminal
- Node.js `>=22.19.0`
- npm
- Git
- At least one supported AI provider credential, or login through the CLI

## Install on Linux / macOS

```bash
curl -fsSL https://console.upskillsafrica.org/install.sh | bash
```

Custom install folder:

```bash
curl -fsSL https://console.upskillsafrica.org/install.sh | GIHANGA_INSTALL_DIR="$HOME/Tools/gihanga-cli" bash
```

## Install on Windows PowerShell

```powershell
iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex
```

Custom install folder:

```powershell
$env:GIHANGA_INSTALL_DIR="$HOME\Tools\gihanga-cli"; iwr https://console.upskillsafrica.org/install.ps1 -UseB | iex
```

The installer clones or updates Gihanga CLI in `~/.gihanga-cli`, builds it, and links the `gihanga` command for the current user.

## Manual install

```bash
git clone https://github.com/DannyIRUMVA/gihanga-command-line-interface.git
cd gihanga-command-line-interface
npm install --ignore-scripts
npm run build
cd packages/coding-agent
npm link
gihanga --help
```

## Basic usage

```bash
# Start interactive mode
gihanga

# Ask one question and exit
gihanga -p "Explain this project"

# Include files in the first message
gihanga @README.md "Summarize this file"

# Show help
gihanga --help

# List available models
gihanga --list-models
```

## Common commands

```bash
gihanga install <source>      # Install an extension/package source
gihanga remove <source>       # Remove an extension/package source
gihanga update                # Update Gihanga
gihanga list                  # List installed packages/extensions
gihanga config                # Open package resource configuration
```

Inside interactive mode, type `/` to see slash commands such as:

```text
/settings
/model
/kwinjira
/continue
/new
/compact
/sohoka
```

## Authentication

You can start Gihanga and use `/kwinjira`:

```bash
gihanga
# then type: /kwinjira
```

Or provide an API key through environment variables such as:

```bash
export ANTHROPIC_API_KEY="your-api-key"
gihanga
```

Supported providers include Anthropic, OpenAI, Google Gemini, GitHub Copilot, OpenRouter, Groq, Cerebras, Mistral, Amazon Bedrock, Cloudflare, and others.

## Development

```bash
npm install --ignore-scripts
npm run build
npm run check
./gihanga-test.sh
```

Windows development:

```powershell
.\gihanga-test.ps1
```

## Notes

- The command name is `gihanga`.
- Command flags stay in English for compatibility, while help text is Kinyarwanda-first.
- This project is adapted for the Kinyarwanda developer community.

## License

MIT open source license. You can use, copy, modify, distribute, sublicense, and sell copies under the terms in [LICENSE](LICENSE).
