# Contributing to Gihanga CLI

Thank you for helping improve Gihanga CLI.

Gihanga is a Kinyarwanda-first AI coding assistant for the terminal. Contributions should keep the project useful, understandable, and welcoming for the Kinyarwanda developer community.

## Philosophy

Gihanga should stay practical and focused:

- Keep the terminal workflow simple.
- Keep the command `gihanga` stable.
- Keep help text clear and Kinyarwanda-first.
- Prefer extensions, ubumenyi, prompt templates, or themes for features that do not belong in the core.
- Avoid adding complexity that makes the CLI harder to maintain.

## The One Rule

**Understand your code before you submit it.**

If you cannot explain what your change does, why it is needed, and how it affects the rest of the system, do not submit it yet.

Using AI tools is allowed. Submitting code you do not understand is not.

## Good Contributions

Good contributions are:

- small and focused
- easy to review
- tested when they change behavior
- clear about the problem they solve
- respectful of existing functionality
- careful with user-facing Kinyarwanda wording

Examples:

- Fixing a bug with a short reproduction
- Improving Kinyarwanda help text
- Improving documentation or install instructions
- Adding a focused test for changed behavior
- Improving extension, ubumenyi, or theme support

## Issues

Before opening an issue:

- Search existing issues first.
- Keep the report short and concrete.
- Explain what happened and what you expected.
- Include steps to reproduce when possible.
- Include logs only when they help.
- If the issue is about translation, include the exact current text and your proposed replacement.

## Pull Requests

Before submitting a pull request:

```bash
npm run check
./test.sh
```

Both should pass unless you clearly explain why they could not be run.

PRs should include:

- what changed
- why it changed
- how you tested it
- any risk or follow-up work

## Translation Guidelines

Gihanga is Kinyarwanda-first, but developer terms can stay in English when that is clearer.

Preferred wording:

- code: `kode`
- skills: `ubumenyi`
- extensions: `ingereko`
- settings/config: `igenamiterere`
- session: `ikiganiro`
- model: `icyitegererezo`
- command: `itegeko` or `command` when referring to literal terminal input

Keep literal flags and command names unchanged:

- `gihanga`
- `--help`
- `--model`
- `/settings`
- `/kwinjira`

Do not translate command syntax if it would break copy-paste examples.

## Development Setup

Install locally:

```bash
curl -fsSL https://console.upskillsafrica.org/install.sh | bash
```

Manual development setup:

```bash
npm install --ignore-scripts
npm run build
npm run check
./test.sh
```

## Security

Do not commit secrets, tokens, API keys, private keys, or personal credentials.

Do not paste real API keys into issues or pull requests. Use placeholders such as:

```bash
export ANTHROPIC_API_KEY="your-api-key"
```

## License

By contributing, you agree that your contribution is licensed under the MIT license used by this repository.
