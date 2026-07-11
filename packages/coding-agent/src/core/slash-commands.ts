import { APP_NAME } from "../config.ts";
import type { SourceInfo } from "./source-info.ts";

export type SlashCommandSource = "extension" | "prompt" | "skill";

export interface SlashCommandInfo {
	name: string;
	description?: string;
	source: SlashCommandSource;
	sourceInfo: SourceInfo;
}

export interface BuiltinSlashCommand {
	name: string;
	description: string;
	argumentHint?: string;
}

export const BUILTIN_SLASH_COMMANDS: ReadonlyArray<BuiltinSlashCommand> = [
	{ name: "settings", description: "Fungura menu y'igenamiterere" },
	{ name: "model", description: "Hitamo icyitegererezo (ifungura selector UI)", argumentHint: "<provider/model>" },
	{ name: "scoped-models", description: "Emera cyangwa uhagarike ibyitegererezo byo guhinduranya na Ctrl+P" },
	{ name: "export", description: "Ohereza ikiganiro (HTML ni default, cyangwa tanga path: .html/.jsonl)" },
	{ name: "import", description: "Injiza kandi ukomeze ikiganiro kiva muri dosiye ya JSONL" },
	{ name: "share", description: "Sangiza ikiganiro nka GitHub gist y'ibanga" },
	{ name: "copy", description: "Koporora ubutumwa bwa nyuma bw'umufasha muri clipboard" },
	{ name: "name", description: "Gena izina ry'ikiganiro rigaragara" },
	{ name: "session", description: "Erekana amakuru n'imibare by'ikiganiro" },
	{ name: "changelog", description: "Erekana ibyahindutse muri changelog" },
	{ name: "hotkeys", description: "Erekana shortcuts zose za keyboard" },
	{ name: "fork", description: "Rema fork nshya uhereye ku butumwa bw'umukoresha bwabanje" },
	{ name: "clone", description: "Koporora ikiganiro kiriho aho kigeze ubu" },
	{ name: "tree", description: "Genda mu giti cy'ikiganiro (hindura amashami)" },
	{ name: "trust", description: "Bika icyemezo cyo kwizera poroje ku biganiro bizaza" },
	{ name: "kwinjira", description: "Tegura authentication ya provider", argumentHint: "<provider>" },
	{ name: "logout", description: "Kuraho authentication ya provider" },
	{ name: "new", description: "Tangira ikiganiro gishya" },
	{ name: "compact", description: "Gabanya context y'ikiganiro ukoresheje compact" },
	{ name: "continue", description: "Komeza ikiganiro" },
	{
		name: "reload",
		description: "Ongera ufungure keybindings, ingereko, ubumenyi, prompts, themes, na context files",
	},
	{ name: "sohoka", description: `Sohoka muri ${APP_NAME}` },
];
