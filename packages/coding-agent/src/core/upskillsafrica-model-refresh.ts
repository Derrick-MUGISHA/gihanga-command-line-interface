import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stripJsonComments } from "../utils/json.ts";

const UPSKILLSAFRICA_PROVIDER_ID = "upskillsafrica";
const DEFAULT_BACKEND_URL = "https://upskillsafrica-ai-backend.boyg87059.workers.dev";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;

interface BackendModel {
	id?: unknown;
	name?: unknown;
	capabilities?: unknown;
	priceTier?: unknown;
	requiresOrgCode?: unknown;
}

interface BackendModelsResponse {
	models?: BackendModel[];
}

interface ModelDefinition {
	id: string;
	name?: string;
	api?: string;
	baseUrl?: string;
	reasoning?: boolean;
	input?: Array<"text" | "image">;
	cost?: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		tiers?: Array<Record<string, unknown>>;
	};
	contextWindow?: number;
	maxTokens?: number;
	headers?: Record<string, string>;
	compat?: Record<string, unknown>;
}

interface ProviderConfig {
	name?: string;
	baseUrl?: string;
	apiKey?: string;
	api?: string;
	headers?: Record<string, string>;
	compat?: Record<string, unknown>;
	authHeader?: boolean;
	models?: ModelDefinition[];
	modelOverrides?: Record<string, unknown>;
}

interface ModelsConfig {
	providers?: Record<string, ProviderConfig>;
}

interface RefreshMetadata {
	lastAttemptAt?: number;
	lastSuccessAt?: number;
	lastModelIds?: string[];
}

export interface UpskillsafricaModelRefreshResult {
	attempted: boolean;
	updated: boolean;
	modelCount?: number;
	error?: string;
}

function readJsonFile<T>(path: string): T | undefined {
	if (!existsSync(path)) return undefined;
	return JSON.parse(stripJsonComments(readFileSync(path, "utf-8"))) as T;
}

function writeJsonFile(path: string, value: unknown): void {
	mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf-8", mode: 0o600 });
}

function getRefreshMetadataPath(agentDir: string): string {
	return join(agentDir, "models.refresh.json");
}

function shouldRefresh(agentDir: string, force: boolean): boolean {
	if (force) return true;
	const metadata = readJsonFile<RefreshMetadata>(getRefreshMetadataPath(agentDir));
	const lastAttemptAt = metadata?.lastAttemptAt ?? 0;
	return Date.now() - lastAttemptAt >= REFRESH_INTERVAL_MS;
}

function writeRefreshMetadata(agentDir: string, metadata: RefreshMetadata): void {
	writeJsonFile(getRefreshMetadataPath(agentDir), metadata);
}

function uniqueSorted(values: string[]): string[] {
	return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function hasModelListChanged(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return true;
	return a.some((value, index) => value !== b[index]);
}

function fallbackCost(model: BackendModel): ModelDefinition["cost"] {
	if (model.priceTier === "free") {
		return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
	}
	return { input: 1, output: 6, cacheRead: 0.1, cacheWrite: 1.25 };
}

function inferReasoning(model: BackendModel, existing?: ModelDefinition): boolean {
	if (typeof existing?.reasoning === "boolean") return existing.reasoning;
	return Array.isArray(model.capabilities) && model.capabilities.includes("reasoning");
}

function inferMaxTokens(model: BackendModel, existing?: ModelDefinition): number {
	if (typeof existing?.maxTokens === "number" && existing.maxTokens > 0) return existing.maxTokens;
	return inferReasoning(model, existing) || model.requiresOrgCode === true ? 32768 : 16384;
}

function mapBackendModel(model: BackendModel, existing?: ModelDefinition): ModelDefinition | undefined {
	if (typeof model.id !== "string" || model.id.trim().length === 0) return undefined;
	return {
		...existing,
		id: model.id,
		name: typeof model.name === "string" && model.name.trim().length > 0 ? model.name : (existing?.name ?? model.id),
		contextWindow:
			typeof existing?.contextWindow === "number" && existing.contextWindow > 0 ? existing.contextWindow : 128000,
		maxTokens: inferMaxTokens(model, existing),
		input: ["text"],
		reasoning: inferReasoning(model, existing),
		cost: existing?.cost ?? fallbackCost(model),
	};
}

async function fetchBackendModels(backendUrl: string): Promise<BackendModel[]> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(`${backendUrl.replace(/\/$/, "")}/models`, {
			headers: { accept: "application/json" },
			signal: controller.signal,
		});
		if (!response.ok) throw new Error(`backend returned ${response.status}`);
		const data = (await response.json()) as BackendModelsResponse;
		return Array.isArray(data.models) ? data.models : [];
	} finally {
		clearTimeout(timeout);
	}
}

export async function refreshUpskillsafricaModels(options: {
	agentDir: string;
	modelsJsonPath?: string;
	backendUrl?: string;
	force?: boolean;
}): Promise<UpskillsafricaModelRefreshResult> {
	if (
		process.env.GIHANGA_DISABLE_MODEL_REFRESH === "1" ||
		process.env.GIHANGA_OFFLINE === "1" ||
		process.env.PI_OFFLINE === "1"
	) {
		return { attempted: false, updated: false };
	}

	const { agentDir, force = false } = options;
	const modelsJsonPath = options.modelsJsonPath ?? join(agentDir, "models.json");
	const backendUrl = options.backendUrl ?? process.env.UPSKILLSAFRICA_BACKEND_URL ?? DEFAULT_BACKEND_URL;

	if (!shouldRefresh(agentDir, force)) {
		return { attempted: false, updated: false };
	}

	const now = Date.now();
	try {
		const current = readJsonFile<ModelsConfig>(modelsJsonPath) ?? { providers: {} };
		current.providers ??= {};
		const provider = current.providers[UPSKILLSAFRICA_PROVIDER_ID] ?? {
			name: "Upskillsafrica AI",
			baseUrl: `${backendUrl.replace(/\/$/, "")}/v1`,
			api: "openai-completions",
			authHeader: true,
			apiKey: "$UPSKILLSAFRICA_API_KEY",
			models: [],
		};

		const backendModels = await fetchBackendModels(backendUrl);
		const existingById = new Map((provider.models ?? []).map((model) => [model.id, model]));
		const refreshedModels = backendModels
			.map((model) => mapBackendModel(model, typeof model.id === "string" ? existingById.get(model.id) : undefined))
			.filter((model): model is ModelDefinition => model !== undefined);

		if (refreshedModels.length === 0) throw new Error("backend returned no models");

		provider.models = refreshedModels;
		provider.baseUrl ??= `${backendUrl.replace(/\/$/, "")}/v1`;
		provider.api ??= "openai-completions";
		provider.authHeader ??= true;
		provider.apiKey ??= "$UPSKILLSAFRICA_API_KEY";
		current.providers[UPSKILLSAFRICA_PROVIDER_ID] = provider;

		const oldIds = uniqueSorted((existingById.size > 0 ? Array.from(existingById.keys()) : []).filter(Boolean));
		const newIds = uniqueSorted(refreshedModels.map((model) => model.id));
		const currentSerialized = existsSync(modelsJsonPath) ? readFileSync(modelsJsonPath, "utf-8") : "";
		const nextSerialized = `${JSON.stringify(current, null, 2)}\n`;
		const updated = currentSerialized !== nextSerialized;
		if (updated) writeJsonFile(modelsJsonPath, current);

		writeRefreshMetadata(agentDir, {
			lastAttemptAt: now,
			lastSuccessAt: now,
			lastModelIds: newIds,
		});

		return {
			attempted: true,
			updated: updated || hasModelListChanged(oldIds, newIds),
			modelCount: refreshedModels.length,
		};
	} catch (error) {
		writeRefreshMetadata(agentDir, { lastAttemptAt: now });
		return {
			attempted: true,
			updated: false,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
