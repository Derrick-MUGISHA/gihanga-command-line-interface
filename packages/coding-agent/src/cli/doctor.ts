import { existsSync, readFileSync } from "node:fs";
import { delimiter } from "node:path";
import type { AuthStorage } from "../core/auth-storage.ts";
import type { ModelRegistry } from "../core/model-registry.ts";
import type { SettingsManager } from "../core/settings-manager.ts";
import { refreshUpskillsafricaModels } from "../core/upskillsafrica-model-refresh.ts";
import { stripJsonComments } from "../utils/json.ts";

const UPSKILLSAFRICA_PROVIDER_ID = "upskillsafrica";
const UPSKILLSAFRICA_BACKEND_URL = "https://upskillsafrica-ai-backend.boyg87059.workers.dev";

interface DoctorCheck {
	name: string;
	status: "ok" | "warn" | "fail";
	detail: string;
}

function check(status: DoctorCheck["status"], name: string, detail: string): DoctorCheck {
	return { name, status, detail };
}

function formatStatus(status: DoctorCheck["status"]): string {
	if (status === "ok") return "OK";
	if (status === "warn") return "WARN";
	return "FAIL";
}

function isExecutableOnPath(command: string): boolean {
	const pathValue = process.env.PATH ?? "";
	const suffixes = process.platform === "win32" ? [".cmd", ".exe", ".bat", ""] : [""];
	return pathValue.split(delimiter).some((dir) => suffixes.some((suffix) => existsSync(`${dir}/${command}${suffix}`)));
}

async function checkBackend(): Promise<DoctorCheck> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 3000);
	try {
		const response = await fetch(`${UPSKILLSAFRICA_BACKEND_URL}/health`, { signal: controller.signal });
		if (!response.ok)
			return check("warn", "Upskillsafrica backend", `reachable but returned HTTP ${response.status}`);
		return check("ok", "Upskillsafrica backend", "reachable");
	} catch (error) {
		return check("warn", "Upskillsafrica backend", error instanceof Error ? error.message : String(error));
	} finally {
		clearTimeout(timeout);
	}
}

function checkModelsJson(agentDir: string): DoctorCheck {
	const path = `${agentDir}/models.json`;
	if (!existsSync(path)) return check("warn", "models.json", `missing at ${path}`);
	try {
		const parsed = JSON.parse(stripJsonComments(readFileSync(path, "utf-8"))) as {
			providers?: Record<string, { models?: Array<{ id?: unknown; input?: unknown; cost?: unknown }> }>;
		};
		const models = parsed.providers?.[UPSKILLSAFRICA_PROVIDER_ID]?.models ?? [];
		const invalidInputs = models.filter(
			(model) => !Array.isArray(model.input) || model.input.some((value) => value !== "text" && value !== "image"),
		);
		const missingCost = models.filter((model) => {
			const cost = model.cost as Record<string, unknown> | undefined;
			return !cost || ["input", "output", "cacheRead", "cacheWrite"].some((key) => typeof cost[key] !== "number");
		});
		if (invalidInputs.length > 0)
			return check("fail", "models.json", `${invalidInputs.length} invalid input entries`);
		if (missingCost.length > 0)
			return check("warn", "models.json", `${missingCost.length} models missing cost rates`);
		return check("ok", "models.json", `${models.length} Upskillsafrica models at ${path}`);
	} catch (error) {
		return check("fail", "models.json", error instanceof Error ? error.message : String(error));
	}
}

function checkAuth(authStorage: AuthStorage): DoctorCheck {
	const status = authStorage.getAuthStatus(UPSKILLSAFRICA_PROVIDER_ID);
	if (authStorage.hasAuth(UPSKILLSAFRICA_PROVIDER_ID)) {
		return check("ok", "Upskillsafrica auth", status.label ?? status.source ?? "configured");
	}
	return check("warn", "Upskillsafrica auth", "not configured; run /kwinjira or set UPSKILLSAFRICA_API_KEY");
}

function checkDefaultModel(settingsManager: SettingsManager, modelRegistry: ModelRegistry): DoctorCheck {
	const provider = settingsManager.getDefaultProvider();
	const model = settingsManager.getDefaultModel();
	if (!provider || !model) return check("warn", "Default model", "not set");
	const found = modelRegistry.find(provider, model);
	if (!found) return check("warn", "Default model", `${provider}/${model} not found in catalog`);
	return check("ok", "Default model", `${provider}/${model}`);
}

export async function runDoctor(options: {
	agentDir: string;
	authStorage: AuthStorage;
	modelRegistry: ModelRegistry;
	settingsManager: SettingsManager;
}): Promise<number> {
	const checks: DoctorCheck[] = [];
	checks.push(check("ok", "Node.js", process.version));
	checks.push(check(existsSync(options.agentDir) ? "ok" : "warn", "Agent directory", options.agentDir));
	checks.push(
		check(
			isExecutableOnPath("git") ? "ok" : "warn",
			"git",
			isExecutableOnPath("git") ? "available" : "not found on PATH",
		),
	);
	checks.push(
		check(
			isExecutableOnPath("npm") ? "ok" : "warn",
			"npm",
			isExecutableOnPath("npm") ? "available" : "not found on PATH",
		),
	);

	const refresh = await refreshUpskillsafricaModels({ agentDir: options.agentDir, force: true });
	if (refresh.error) {
		checks.push(check("warn", "Model refresh", refresh.error));
	} else {
		checks.push(
			check(
				"ok",
				"Model refresh",
				refresh.updated ? `updated catalog (${refresh.modelCount ?? "unknown"} models)` : "catalog already current",
			),
		);
	}
	options.modelRegistry.refresh();

	checks.push(checkModelsJson(options.agentDir));
	checks.push(checkAuth(options.authStorage));
	checks.push(checkDefaultModel(options.settingsManager, options.modelRegistry));
	checks.push(
		check(
			options.modelRegistry.getAvailable().length > 0 ? "ok" : "warn",
			"Available models",
			`${options.modelRegistry.getAvailable().length} configured / ${options.modelRegistry.getAll().length} total`,
		),
	);
	checks.push(await checkBackend());

	const loadError = options.modelRegistry.getError();
	if (loadError) checks.push(check("fail", "Model registry", loadError));

	console.log("Gihanga doctor\n");
	for (const item of checks) {
		console.log(`${formatStatus(item.status).padEnd(4)}  ${item.name.padEnd(24)} ${item.detail}`);
	}

	const hasFailure = checks.some((item) => item.status === "fail");
	const hasWarning = checks.some((item) => item.status === "warn");
	console.log("");
	if (hasFailure) {
		console.log("Result: problems found. Fix FAIL items first, then rerun `gihanga doctor`.");
		return 1;
	}
	if (hasWarning) {
		console.log("Result: usable, with warnings.");
		return 0;
	}
	console.log("Result: ready.");
	return 0;
}
