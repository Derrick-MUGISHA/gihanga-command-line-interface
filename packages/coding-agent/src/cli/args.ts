/**
 * CLI argument parsing and help display
 */

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import chalk from "chalk";
import { APP_NAME, CONFIG_DIR_NAME, ENV_AGENT_DIR, ENV_SESSION_DIR } from "../config.ts";
import type { ExtensionFlag } from "../core/extensions/types.ts";

export type Mode = "text" | "json" | "rpc";

export interface Args {
	provider?: string;
	model?: string;
	apiKey?: string;
	systemPrompt?: string;
	appendSystemPrompt?: string[];
	thinking?: ThinkingLevel;
	continue?: boolean;
	resume?: boolean;
	help?: boolean;
	version?: boolean;
	vuga?: boolean;
	doctor?: boolean;
	mode?: Mode;
	name?: string;
	noSession?: boolean;
	session?: string;
	sessionId?: string;
	fork?: string;
	sessionDir?: string;
	models?: string[];
	tools?: string[];
	excludeTools?: string[];
	noTools?: boolean;
	noBuiltinTools?: boolean;
	extensions?: string[];
	noExtensions?: boolean;
	print?: boolean;
	export?: string;
	noSkills?: boolean;
	skills?: string[];
	promptTemplates?: string[];
	noPromptTemplates?: boolean;
	themes?: string[];
	noThemes?: boolean;
	noContextFiles?: boolean;
	listModels?: string | true;
	offline?: boolean;
	verbose?: boolean;
	projectTrustOverride?: boolean;
	messages: string[];
	fileArgs: string[];
	/** Unknown flags (potentially extension flags) - map of flag name to value */
	unknownFlags: Map<string, boolean | string>;
	diagnostics: Array<{ type: "warning" | "error"; message: string }>;
}

const VALID_THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export function isValidThinkingLevel(level: string): level is ThinkingLevel {
	return VALID_THINKING_LEVELS.includes(level as ThinkingLevel);
}

export function parseArgs(args: string[]): Args {
	const result: Args = {
		messages: [],
		fileArgs: [],
		unknownFlags: new Map(),
		diagnostics: [],
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];

		if (arg === "--help" || arg === "-h") {
			result.help = true;
		} else if (arg === "--version" || arg === "-v") {
			result.version = true;
		} else if (arg === "vuga") {
			result.vuga = true;
		} else if (arg === "doctor") {
			result.doctor = true;
		} else if (arg === "--mode" && i + 1 < args.length) {
			const mode = args[++i];
			if (mode === "text" || mode === "json" || mode === "rpc") {
				result.mode = mode;
			}
		} else if (arg === "--continue" || arg === "-c") {
			result.continue = true;
		} else if (arg === "--resume" || arg === "-r") {
			result.resume = true;
		} else if (arg === "--provider" && i + 1 < args.length) {
			result.provider = args[++i];
		} else if (arg === "--model" && i + 1 < args.length) {
			result.model = args[++i];
		} else if (arg === "--api-key" && i + 1 < args.length) {
			result.apiKey = args[++i];
		} else if (arg === "--system-prompt" && i + 1 < args.length) {
			result.systemPrompt = args[++i];
		} else if (arg === "--append-system-prompt" && i + 1 < args.length) {
			result.appendSystemPrompt = result.appendSystemPrompt ?? [];
			result.appendSystemPrompt.push(args[++i]);
		} else if (arg === "--name" || arg === "-n") {
			if (i + 1 < args.length) {
				result.name = args[++i];
			} else {
				result.diagnostics.push({ type: "error", message: "--name requires a value" });
			}
		} else if (arg === "--no-session") {
			result.noSession = true;
		} else if (arg === "--session" && i + 1 < args.length) {
			result.session = args[++i];
		} else if (arg === "--session-id" && i + 1 < args.length) {
			result.sessionId = args[++i];
		} else if (arg === "--fork" && i + 1 < args.length) {
			result.fork = args[++i];
		} else if (arg === "--session-dir" && i + 1 < args.length) {
			result.sessionDir = args[++i];
		} else if (arg === "--models" && i + 1 < args.length) {
			result.models = args[++i].split(",").map((s) => s.trim());
		} else if (arg === "--no-tools" || arg === "-nt") {
			result.noTools = true;
		} else if (arg === "--no-builtin-tools" || arg === "-nbt") {
			result.noBuiltinTools = true;
		} else if ((arg === "--tools" || arg === "-t") && i + 1 < args.length) {
			result.tools = args[++i]
				.split(",")
				.map((s) => s.trim())
				.filter((name) => name.length > 0);
		} else if ((arg === "--exclude-tools" || arg === "-xt") && i + 1 < args.length) {
			result.excludeTools = args[++i]
				.split(",")
				.map((s) => s.trim())
				.filter((name) => name.length > 0);
		} else if (arg === "--thinking" && i + 1 < args.length) {
			const level = args[++i];
			if (isValidThinkingLevel(level)) {
				result.thinking = level;
			} else {
				result.diagnostics.push({
					type: "warning",
					message: `Invalid thinking level "${level}". Valid values: ${VALID_THINKING_LEVELS.join(", ")}`,
				});
			}
		} else if (arg === "--print" || arg === "-p") {
			result.print = true;
			const next = args[i + 1];
			if (next !== undefined && !next.startsWith("@") && (!next.startsWith("-") || next.startsWith("---"))) {
				result.messages.push(next);
				i++;
			}
		} else if (arg === "--export" && i + 1 < args.length) {
			result.export = args[++i];
		} else if ((arg === "--extension" || arg === "-e") && i + 1 < args.length) {
			result.extensions = result.extensions ?? [];
			result.extensions.push(args[++i]);
		} else if (arg === "--no-extensions" || arg === "-ne") {
			result.noExtensions = true;
		} else if (arg === "--skill" && i + 1 < args.length) {
			result.skills = result.skills ?? [];
			result.skills.push(args[++i]);
		} else if (arg === "--prompt-template" && i + 1 < args.length) {
			result.promptTemplates = result.promptTemplates ?? [];
			result.promptTemplates.push(args[++i]);
		} else if (arg === "--theme" && i + 1 < args.length) {
			result.themes = result.themes ?? [];
			result.themes.push(args[++i]);
		} else if (arg === "--no-skills" || arg === "-ns") {
			result.noSkills = true;
		} else if (arg === "--no-prompt-templates" || arg === "-np") {
			result.noPromptTemplates = true;
		} else if (arg === "--no-themes") {
			result.noThemes = true;
		} else if (arg === "--no-context-files" || arg === "-nc") {
			result.noContextFiles = true;
		} else if (arg === "--list-models") {
			// Check if next arg is a search pattern (not a flag or file arg)
			if (i + 1 < args.length && !args[i + 1].startsWith("-") && !args[i + 1].startsWith("@")) {
				result.listModels = args[++i];
			} else {
				result.listModels = true;
			}
		} else if (arg === "--verbose") {
			result.verbose = true;
		} else if (arg === "--approve" || arg === "-a") {
			result.projectTrustOverride = true;
		} else if (arg === "--no-approve" || arg === "-na") {
			result.projectTrustOverride = false;
		} else if (arg === "--offline") {
			result.offline = true;
		} else if (arg.startsWith("@")) {
			result.fileArgs.push(arg.slice(1)); // Remove @ prefix
		} else if (arg.startsWith("--")) {
			const eqIndex = arg.indexOf("=");
			if (eqIndex !== -1) {
				result.unknownFlags.set(arg.slice(2, eqIndex), arg.slice(eqIndex + 1));
			} else {
				const flagName = arg.slice(2);
				const next = args[i + 1];
				if (next !== undefined && !next.startsWith("-") && !next.startsWith("@")) {
					result.unknownFlags.set(flagName, next);
					i++;
				} else {
					result.unknownFlags.set(flagName, true);
				}
			}
		} else if (arg.startsWith("-") && !arg.startsWith("--")) {
			result.diagnostics.push({ type: "error", message: `Unknown option: ${arg}` });
		} else if (!arg.startsWith("-")) {
			result.messages.push(arg);
		}
	}

	return result;
}

export function printHelp(extensionFlags?: ExtensionFlag[]): void {
	const extensionFlagsText =
		extensionFlags && extensionFlags.length > 0
			? `\n${chalk.bold("Extension CLI Flags:")}\n${extensionFlags
					.map((flag) => {
						const value = flag.type === "string" ? " <value>" : "";
						const description = flag.description ?? `Registered by ${flag.extensionPath}`;
						return `  --${flag.name}${value}`.padEnd(30) + description;
					})
					.join("\n")}\n`
			: "";
	console.log(`${chalk.bold(APP_NAME)} - Umufasha wa AI mu kwandika kode ufite ibikoresho byo gusoma, gukoresha bash, guhindura, no kwandika dosiye

${chalk.bold("Imikoreshereze:")}
  ${APP_NAME} [options] [@files...] [messages...]

${chalk.bold("Amategeko:")}
  ${APP_NAME} install <source> [-l]     Injiza isoko y'ingereko maze uyongere mu igenamiterere
  ${APP_NAME} remove <source> [-l]      Kuramo isoko y'ingereko mu igenamiterere
  ${APP_NAME} uninstall <source> [-l]   Izina risimbura remove
  ${APP_NAME} update [source|self|gihanga] Vugurura Gihanga (koresha --all kuri Gihanga n'ingereko)
  ${APP_NAME} list                      Erekana ingereko zinjijwe ziri mu igenamiterere
  ${APP_NAME} config [-l]               Fungura TUI kugira ngo wemere cyangwa uhagarike umutungo w'amapakeji (Tab ihindura scope)
  ${APP_NAME} doctor                    Suzuma installation, auth, models, na backend
  ${APP_NAME} org add <code>            Bika organisation code ya Upskillsafrica
  ${APP_NAME} org status                Reba uko organisation access ihagaze
  ${APP_NAME} <command> --help          Erekana ubufasha ku mategeko install/remove/uninstall/update/list/config

${chalk.bold("Amahitamo:")}
  --provider <name>              Izina rya provider (default: google)
  --model <pattern>              Imiterere cyangwa ID y'icyitegererezo (yemera "provider/id" na ":<thinking>" itari ngombwa)
  --api-key <key>                Urufunguzo rwa API (default: env vars)
  --system-prompt <text>         Amabwiriza remezo ya sisitemu (default: amabwiriza y'umufasha wa kode)
  --append-system-prompt <text>  Ongeraho umwandiko cyangwa ibiri muri dosiye ku mabwiriza remezo ya sisitemu (bishobora gusubirwamo)
  --mode <mode>                  Uburyo bwo kwerekana ibisubizo: text (default), json, cyangwa rpc
  --print, -p                    Uburyo butari ibiganiro: kora ibwiriza hanyuma usohoke
  --continue, -c                 Komeza ikiganiro giheruka
  --resume, -r                   Hitamo ikiganiro cyo gukomeza
  --session <path|id>            Koresha dosiye y'ikiganiro yihariye cyangwa igice cya UUID
  --session-id <id>              Koresha ID nyayo y'ikiganiro cya poroje; uyireme niba itabonetse
  --fork <path|id>               Shinga ikiganiro gishya uhereye kuri dosiye y'ikiganiro cyangwa igice cya UUID
  --session-dir <dir>            Ububiko bwo kubikamo no gushakiramo ibiganiro
  --no-session                   Ntubike ikiganiro (ephemeral)
  --name, -n <name>              Gena izina ry'ikiganiro rigaragara
  --models <patterns>            Imiterere y'ibyitegererezo itandukanijwe n'utwatuzo, ikoreshwa mu guhinduranya na Ctrl+P
                                 Yemera glob patterns (anthropic/*, *sonnet*) na fuzzy matching
  --no-tools, -nt                Hagarika ibikoresho byose ku buryo busanzwe (ibisanzwe n'ingereko)
  --no-builtin-tools, -nbt       Hagarika ibikoresho bisanzwe birimo, ariko ugumane ingereko n'ibikoresho byihariye bikora
  --tools, -t <tools>            Urutonde rw'ibikoresho byemewe gukora, bitandukanijwe n'utwatuzo
                                 Bikora ku bikoresho bisanzwe, ingereko, n'ibikoresho byihariye
  --exclude-tools, -xt <tools>   Urutonde rw'ibikoresho bigomba guhagarikwa, bitandukanijwe n'utwatuzo
                                 Bikora ku bikoresho bisanzwe, ingereko, n'ibikoresho byihariye
  --thinking <level>             Gena urwego rwo gutekereza: off, minimal, low, medium, high, xhigh, max
  --extension, -e <path>         Fungura dosiye y'ingereko (bishobora gusubirwamo)
  --no-extensions, -ne           Hagarika gushakisha ingereko (inzira za -e zitanzwe ziracyakora)
  --skill <path>                 Fungura dosiye cyangwa ububiko bw'ubumenyi (bishobora gusubirwamo)
  --no-skills, -ns               Hagarika gushakisha no gufungura ubumenyi
  --prompt-template <path>       Fungura dosiye cyangwa ububiko bw'inyandikorugero y'amabwiriza (bishobora gusubirwamo)
  --no-prompt-templates, -np     Hagarika gushakisha no gufungura inyandikorugero z'amabwiriza
  --theme <path>                 Fungura dosiye cyangwa ububiko bw'insanganyamatsiko (bishobora gusubirwamo)
  --no-themes                    Hagarika gushakisha no gufungura insanganyamatsiko
  --no-context-files, -nc        Hagarika gushakisha no gufungura AGENTS.md na CLAUDE.md
  --export <file>                Ohereza dosiye y'ikiganiro muri HTML hanyuma usohoke
  --list-models [search]         Erekana ibyitegererezo bihari (ushobora no gushakisha fuzzy)
  --verbose                      Hatiriza gutangira herekana amakuru arambuye (isimbura quietStartup setting)
  --approve, -a                  Izera dosiye zo muri iyi poroje kuri iri koreshwa
  --no-approve, -na              Irengagize dosiye zo muri iyi poroje kuri iri koreshwa
  --offline                      Hagarika ibikorwa by'urusobe mu gutangira (kimwe na GIHANGA_OFFLINE=1)
  --help, -h                     Erekana ubu bufasha
  --version, -v                  Erekana nomero ya version
  vuga                           Tangira ibiganiro by'ijwi bya Upskillsafrica (bisaba subscription)

Ingereko zishobora kongeramo flags nshya (urugero: --plan iva muri plan-mode extension).${extensionFlagsText}

${chalk.bold("Ingero:")}
  # Uburyo bw'ibiganiro
  ${APP_NAME}

  # Uburyo bw'ibiganiro bufite ibwiriza ryo gutangira
  ${APP_NAME} "List all .ts files in src/"

  # Shyiramo amadosiye mu butumwa bwo gutangira
  ${APP_NAME} @prompt.md @image.png "What color is the sky?"

  # Uburyo butari ibiganiro (kora hanyuma usohoke)
  ${APP_NAME} -p "List all .ts files in src/"

  # Ubutumwa bwinshi (ibiganiro)
  ${APP_NAME} "Read package.json" "What dependencies do we have?"

  # Komeza ikiganiro giheruka
  ${APP_NAME} --continue "What did we discuss?"

  # Tangira ikiganiro gifite izina
  ${APP_NAME} --name "Refactor auth module"

  # Koresha icyitegererezo gitandukanye
  ${APP_NAME} --provider openai --model gpt-4o-mini "Help me refactor this code"

  # Koresha icyitegererezo kibanzirizwa n'izina rya provider (--provider si ngombwa)
  ${APP_NAME} --model openai/gpt-4o "Help me refactor this code"

  # Koresha icyitegererezo gifite impine y'urwego rwo gutekereza
  ${APP_NAME} --model sonnet:high "Solve this complex problem"

  # Garukira gusa ku byitegererezo byatoranyijwe mu guhinduranya
  ${APP_NAME} --models claude-sonnet,claude-haiku,gpt-4o

  # Garukira kuri provider runaka ukoresheje glob pattern
  ${APP_NAME} --models "github-copilot/*"

  # Hinduranya ibyitegererezo bifite inzego zo gutekereza zigenwe
  ${APP_NAME} --models sonnet:high,haiku:low

  # Tangira n'urwego rwo gutekereza runaka
  ${APP_NAME} --thinking high "Solve this complex problem"

  # Uburyo bwo gusoma gusa (nta guhindura dosiye)
  ${APP_NAME} --tools read,grep,find,ls -p "Review the code in src/"

  # Hagarika igikoresho kimwe mu gihe ibindi bigumye gukora
  ${APP_NAME} --exclude-tools ask_question

  # Ohereza dosiye y'ikiganiro muri HTML
  ${APP_NAME} --export ~/${CONFIG_DIR_NAME}/agent/sessions/--path--/session.jsonl
  ${APP_NAME} --export session.jsonl output.html

${chalk.bold("Impinduka z'ibidukikije bya porogaramu:")}
  ANTHROPIC_API_KEY                - Anthropic Claude API key
  ANTHROPIC_OAUTH_TOKEN            - Anthropic OAuth token (alternative to API key)
  ANT_LING_API_KEY                 - Ant Ling API key
  OPENAI_API_KEY                   - OpenAI GPT API key
  AZURE_OPENAI_API_KEY             - Azure OpenAI API key
  AZURE_OPENAI_BASE_URL            - Azure OpenAI/Cognitive Services base URL (e.g. https://{resource}.openai.azure.com)
  AZURE_OPENAI_RESOURCE_NAME       - Azure OpenAI resource name (alternative to base URL)
  AZURE_OPENAI_API_VERSION         - Azure OpenAI API version (default: v1)
  AZURE_OPENAI_DEPLOYMENT_NAME_MAP - Azure OpenAI model=deployment map (comma-separated)
  DEEPSEEK_API_KEY                 - DeepSeek API key
  NVIDIA_API_KEY                   - NVIDIA NIM API key
  GEMINI_API_KEY                   - Google Gemini API key
  GROQ_API_KEY                     - Groq API key
  CEREBRAS_API_KEY                 - Cerebras API key
  XAI_API_KEY                      - xAI Grok API key
  FIREWORKS_API_KEY                - Fireworks API key
  TOGETHER_API_KEY                 - Together AI API key
  OPENROUTER_API_KEY               - OpenRouter API key
  AI_GATEWAY_API_KEY               - Vercel AI Gateway API key
  ZAI_API_KEY                      - ZAI Coding Plan API key (Global)
  ZAI_CODING_CN_API_KEY            - ZAI Coding Plan API key (China)
  MISTRAL_API_KEY                  - Mistral API key
  MINIMAX_API_KEY                  - MiniMax API key
  MOONSHOT_API_KEY                 - Moonshot AI API key
  OPENCODE_API_KEY                 - OpenCode Zen/OpenCode Go API key
  KIMI_API_KEY                     - Kimi For Coding API key
  CLOUDFLARE_API_KEY               - Cloudflare API token (Workers AI and AI Gateway)
  CLOUDFLARE_ACCOUNT_ID            - Cloudflare account id (required for both)
  CLOUDFLARE_GATEWAY_ID            - Cloudflare AI Gateway slug (required for AI Gateway)
  XIAOMI_API_KEY                   - Xiaomi MiMo API key (api.xiaomimimo.com billing)
  XIAOMI_TOKEN_PLAN_CN_API_KEY     - Xiaomi MiMo Token Plan API key (China region)
  XIAOMI_TOKEN_PLAN_AMS_API_KEY    - Xiaomi MiMo Token Plan API key (Amsterdam region)
  XIAOMI_TOKEN_PLAN_SGP_API_KEY    - Xiaomi MiMo Token Plan API key (Singapore region)
  AWS_PROFILE                      - AWS profile for Amazon Bedrock
  AWS_ACCESS_KEY_ID                - AWS access key for Amazon Bedrock
  AWS_SECRET_ACCESS_KEY            - AWS secret key for Amazon Bedrock
  AWS_BEARER_TOKEN_BEDROCK         - Bedrock API key (bearer token)
  AWS_REGION                       - AWS region for Amazon Bedrock (e.g., us-east-1)
  ${ENV_AGENT_DIR.padEnd(32)} - Ububiko bw'igenamiterere (default: ~/${CONFIG_DIR_NAME}/agent)
  ${ENV_SESSION_DIR.padEnd(32)} - Ububiko bw'ibiganiro (busimburwa na --session-dir)
  GIHANGA_PACKAGE_DIR              - Simbuza package directory (kuri Nix/Guix store paths)
  GIHANGA_OFFLINE                  - Hagarika ibikorwa by'urusobe mu gutangira iyo ari 1/true/yes
  GIHANGA_TELEMETRY                - Simbuza install telemetry iyo ari 1/true/yes cyangwa 0/false/no
  GIHANGA_SHARE_VIEWER_URL         - Base URL ya /share command

${chalk.bold("Amazina y'ibikoresho bisanzwe birimo:")}
  read   - Soma ibiri muri dosiye
  bash   - Koresha amategeko ya bash
  edit   - Hindura dosiye ukoresheje gushaka no gusimbura
  write  - Andika dosiye (irema cyangwa isimbura)
  grep   - Shakisha mu bikubiye muri dosiye (gusoma gusa, izimye ku buryo busanzwe)
  find   - Shakisha dosiye ukoresheje glob pattern (gusoma gusa, izimye ku buryo busanzwe)
  ls     - Erekana ibiri mu bubiko (gusoma gusa, izimye ku buryo busanzwe)
`);
}
