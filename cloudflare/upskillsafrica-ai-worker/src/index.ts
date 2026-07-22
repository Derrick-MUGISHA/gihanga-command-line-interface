import { neon } from "@neondatabase/serverless";

type JsonObject = Record<string, unknown>;

type ModelSource = "azure_models" | "openrouter" | "nvidia";
type PriceTier = "premium" | "free";
type PlanId = "thirty_minutes" | "hourly" | "twelve_days" | "monthly";

interface EntitlementsKV {
	get(key: string): Promise<string | null>;
	put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

interface Env {
	ENTITLEMENTS: EntitlementsKV;
	PAYMENT_WORKER?: Fetcher;
	DATABASE_URL?: string;
	PAYMENT_WORKER_URL: string;
	AZURE_REALTIME_ENDPOINT?: string;
	AZURE_REALTIME_API_KEY?: string;
	UPSKILLS_REALTIME_MODEL?: string;
	UPSKILLS_REALTIME_MODELS?: string;
	SUBSCRIPTION_AMOUNT_RWF?: string;
	MONTHLY_SUBSCRIPTION_AMOUNT_RWF?: string;
	SUBSCRIPTION_DAYS?: string;
	MONTHLY_GPT5_HOURS_PER_DAY?: string;
	AZURE_AI_PROJECT_ENDPOINT?: string;
	UPSKILLS_AZURE_MODELS?: string;
	UPSKILLS_OPENROUTER_MODELS?: string;
	UPSKILLS_NVIDIA_MODELS?: string;
	AZURE_OPENAI_ENDPOINT?: string;
	AZURE_OPENAI_API_KEY?: string;
	ORG_AZURE_OPENAI_ENDPOINT?: string;
	ORG_AZURE_OPENAI_API_KEY?: string;
	ORG_AZURE_AI_PROJECT_ENDPOINT?: string;
	UPSKILLSAFRICA_ORG_CODE?: string;
	AZURE_OPENAI_API_VERSION?: string;
	AZURE_OPENAI_DEPLOYMENT?: string;
	OPENROUTER_API_KEY?: string;
	NVIDIA_API_KEY?: string;
	NVIDIA_API_ENDPOINT?: string;
	TEST_PAYMENT_BYPASS_PHONE?: string;
}

type SqlRow = Record<string, unknown>;
type NeonQuery = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRow[]>;

interface AuthUser {
	id: string;
	email: string;
}

interface AuthenticatedAccess {
	user: AuthUser;
	entitlement?: AccountEntitlementRecord;
}

interface AccountEntitlementRecord {
	receiptRef: string;
	planId: PlanId;
	amountRwf: number;
	status: string;
	startsAt: string;
	expiresAt: string;
	gpt5DailyMsLimit: number;
}

interface ManagedModel {
	id: string;
	name: string;
	source: ModelSource;
	priceTier: PriceTier;
	capabilities: string[];
	contextWindow?: number;
	maxTokens?: number;
	deployment?: string;
	model?: string;
	version?: string;
	status?: string;
	deploymentType?: string;
	note?: string;
	requiresOrgCode?: boolean;
}

interface PlanDefinition {
	id: PlanId;
	name: string;
	amountRwf: number;
	durationMs: number;
	gpt5DailyMsLimit: number;
	description: string;
}

interface PendingSubscriptionRecord {
	ref: string;
	planId: PlanId;
	amountRwf: number;
	phone: string;
	createdAt: string;
}

interface EntitlementRecord {
	ref: string;
	planId: PlanId;
	amountRwf: number;
	status: string;
	createdAt: string;
	expiresAt: string;
	gpt5DailyMsLimit: number;
}

interface DailyUsageRecord {
	date: string;
	gpt5Ms: number;
	modelRequests: Record<string, number>;
	updatedAt: string;
}

interface ModelUsagePolicy {
	defaultMaxTokens: number;
	hardMaxTokens: number;
	dailyRequests: Record<PlanId, number>;
}

interface ModelQuotaResult {
	trackGpt5: boolean;
	trackModelRequests: boolean;
	limited?: boolean;
	message?: string;
}

const DEFAULT_HOURLY_AMOUNT_RWF = 5000;
const DEFAULT_THIRTY_MINUTES_AMOUNT_RWF = 3000;
const DEFAULT_TWELVE_DAYS_AMOUNT_RWF = 20000;
const DEFAULT_MONTHLY_AMOUNT_RWF = 53000;
const DEFAULT_SUBSCRIPTION_DAYS = 30;
const DEFAULT_MONTHLY_GPT5_HOURS_PER_DAY = 5;
const DEFAULT_AZURE_ENDPOINT = "https://ai-boyg870595858ai912957897118.services.ai.azure.com/openai/v1";
const DEFAULT_AZURE_PROJECT_ENDPOINT = "https://ai-boyg870595858ai912957897118.services.ai.azure.com/api/projects/ai-boyg870595858ai91295-project";
const DEFAULT_ORG_AZURE_ENDPOINT = "https://rask-resource.services.ai.azure.com/openai/v1";
const DEFAULT_ORG_AZURE_PROJECT_ENDPOINT = "https://rask-resource.services.ai.azure.com/api/projects/rask";
const DEFAULT_AZURE_DEPLOYMENT = "gpt-4o-mini";
const ORG_REQUIRED_MODEL_IDS = new Set(["UAF_model_one", "uaf_model_two_alpha", "gpt-realtime-2.1", "gpt-5.6-luna", "gpt-5.5"]);
const DEFAULT_NVIDIA_API_ENDPOINT = "https://integrate.api.nvidia.com/v1";
const STANDARD_PREMIUM_POLICY: ModelUsagePolicy = {
	defaultMaxTokens: 2048,
	hardMaxTokens: 4096,
	dailyRequests: { thirty_minutes: 40, hourly: 80, twelve_days: 160, monthly: 300 },
};
const REASONING_PREMIUM_POLICY: ModelUsagePolicy = {
	defaultMaxTokens: 2048,
	hardMaxTokens: 4096,
	dailyRequests: { thirty_minutes: 6, hourly: 12, twelve_days: 20, monthly: 40 },
};
const NVIDIA_ULTRA_POLICY: ModelUsagePolicy = {
	defaultMaxTokens: 1024,
	hardMaxTokens: 4096,
	dailyRequests: { thirty_minutes: 4, hourly: 8, twelve_days: 12, monthly: 25 },
};

const DEFAULT_AZURE_MODELS: ManagedModel[] = [
	{
		id: "o3",
		name: "o3",
		source: "azure_models",
		priceTier: "premium",
		capabilities: ["chat", "code", "reasoning"],
		deployment: "o3",
		model: "o3",
		status: "Succeeded",
		deploymentType: "Global Standard",
	},
	{
		id: "gpt-4o",
		name: "gpt-4o",
		source: "azure_models",
		priceTier: "premium",
		capabilities: ["chat", "code"],
		deployment: "gpt-4o-mini",
		model: "gpt-4o",
		status: "Succeeded",
		deploymentType: "Global Standard",
	},
	{
		id: "UAF_model_one",
		name: "UAF_model_one",
		source: "azure_models",
		priceTier: "premium",
		capabilities: ["chat", "code", "reasoning"],
		deployment: "gpt-5.5",
		model: "UAF_model_one",
		status: "Succeeded",
		deploymentType: "Global Standard",
		requiresOrgCode: true,
		note: "Requires Upskillsafrica organisation code.",
	},
	{
		id: "uaf_model_two_alpha",
		name: "uaf_model_two_alpha",
		source: "azure_models",
		priceTier: "premium",
		capabilities: ["chat", "code", "reasoning"],
		deployment: "gpt-5.6-luna",
		model: "uaf_model_two_alpha",
		status: "Succeeded",
		deploymentType: "Global Standard",
		requiresOrgCode: true,
		note: "Requires Upskillsafrica organisation code.",
	},
	{
		id: "gpt-realtime-2.1",
		name: "gpt-realtime-2.1",
		source: "azure_models",
		priceTier: "premium",
		capabilities: ["chat", "audio"],
		deployment: "gpt-realtime-2.1",
		model: "gpt-realtime-2.1",
		status: "Succeeded",
		deploymentType: "Global Standard",
		requiresOrgCode: true,
		note: "Realtime voice model; requires Upskillsafrica organisation code.",
	},
	{
		id: "gpt-5.6-luna",
		name: "gpt-5.6-luna",
		source: "azure_models",
		priceTier: "premium",
		capabilities: ["chat", "code", "reasoning"],
		deployment: "gpt-5.6-luna",
		model: "gpt-5.6-luna",
		status: "Succeeded",
		deploymentType: "Global Standard",
		requiresOrgCode: true,
		note: "Requires Upskillsafrica organisation code.",
	},
	{
		id: "gpt-5.5",
		name: "gpt-5.5",
		source: "azure_models",
		priceTier: "premium",
		capabilities: ["chat", "code", "reasoning"],
		deployment: "gpt-5.5",
		model: "gpt-5.5",
		status: "Succeeded",
		deploymentType: "Global Standard",
		requiresOrgCode: true,
		note: "Requires Upskillsafrica organisation code.",
	},
];

const DEFAULT_OPENROUTER_FREE_MODELS: ManagedModel[] = [];

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, { headers: corsHeaders() });
		}

		const url = new URL(request.url);
		try {
			if (url.pathname === "/health") {
				return json({ ok: true, service: "upskillsafrica-ai" });
			}
			if (url.pathname === "/plans" && request.method === "GET") {
				return handlePlans(env);
			}
			if (url.pathname === "/models" && request.method === "GET") {
				return await handleModels(env);
			}
			if (url.pathname === "/auth/register" && request.method === "POST") {
				return await handleRegister(request, env);
			}
			if (url.pathname === "/auth/login" && request.method === "POST") {
				return await handleLogin(request, env);
			}
			if (url.pathname === "/auth/me" && request.method === "GET") {
				return await handleMe(request, env);
			}
			if (url.pathname === "/auth/org-code/verify" && request.method === "POST") {
				return await handleOrgCodeVerify(request, env);
			}
			if (url.pathname === "/v1/realtime/models" && request.method === "GET") {
				return await handleRealtimeModels(request, env);
			}
			if (url.pathname === "/v1/realtime" && request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
				return await handleRealtimeWebSocket(request, env);
			}
			if (url.pathname === "/v1/realtime/client-secrets" && request.method === "POST") {
				return await handleRealtimeClientSecrets(request, env);
			}
			if (url.pathname === "/subscription/start" && request.method === "POST") {
				return await handleSubscriptionStart(request, env);
			}
			if (url.pathname === "/terminal/pay" && request.method === "POST") {
				return await handleTerminalPay(request, env);
			}
			if (url.pathname.startsWith("/subscription/verify/") && request.method === "GET") {
				return await handleSubscriptionVerify(url.pathname.split("/").pop() || "", env);
			}
			if (url.pathname.startsWith("/credits/") && request.method === "GET") {
				return await handleCredits(url.pathname.split("/").pop() || "", env);
			}
			if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
				return await handleChatCompletions(request, env, ctx);
			}
			return json({ message: "Not Found" }, 404);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Internal error";
			if (url.pathname.startsWith("/v1/")) {
				return openAiError(message, 500, "internal_error");
			}
			return json({ message }, 500);
		}
	},
};

function corsHeaders(): HeadersInit {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET,POST,OPTIONS",
		"Access-Control-Allow-Headers": "Authorization,Content-Type,X-Upskillsafrica-Receipt,X-Upskillsafrica-Org-Code",
	};
}

function json(data: JsonObject, status = 200): Response {
	return Response.json(data, { status, headers: corsHeaders() });
}

function cachedJson(data: JsonObject, maxAgeSeconds: number, status = 200): Response {
	return Response.json(data, {
		status,
		headers: { ...corsHeaders(), "Cache-Control": `public, max-age=${maxAgeSeconds}` },
	});
}

function openAiError(message: string, status: number, code = "upskillsafrica_error"): Response {
	return json(
		{
			error: {
				message,
				type: "upskillsafrica_error",
				code,
			},
		},
		status,
	);
}

async function readJsonObject(request: Request): Promise<JsonObject> {
	const value = await request.json();
	if (!isJsonObject(value)) {
		throw new Error("Expected JSON object body.");
	}
	return value;
}

function isJsonObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readDateString(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (value instanceof Date) return value.toISOString();
	return undefined;
}

function readNumber(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseInteger(value: string | undefined, fallback: number): number {
	const parsed = value ? Number.parseInt(value, 10) : Number.NaN;
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSql(env: Env): NeonQuery {
	if (!env.DATABASE_URL) {
		throw new Error("DATABASE_URL is not configured.");
	}
	return neon(env.DATABASE_URL) as unknown as NeonQuery;
}

function toBase64(bytes: ArrayBuffer): string {
	return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function randomToken(byteLength = 32): string {
	const bytes = new Uint8Array(byteLength);
	crypto.getRandomValues(bytes);
	return toBase64(bytes.buffer).replace(/[+/=]/g, (char) => ({ "+": "-", "/": "_", "=": "" })[char] || char);
}

async function sha256Base64(value: string): Promise<string> {
	return toBase64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function hashPassword(password: string, salt: string): Promise<string> {
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100_000 },
		key,
		256,
	);
	return toBase64(bits);
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

function requirePassword(password: string | undefined): string | Response {
	if (!password || password.length < 8) {
		return json({ message: "Password must be at least 8 characters." }, 400);
	}
	return password;
}

function getPlans(env: Env): PlanDefinition[] {
	const monthlyDays = parseInteger(env.SUBSCRIPTION_DAYS, DEFAULT_SUBSCRIPTION_DAYS);
	const monthlyGpt5Hours = parseInteger(env.MONTHLY_GPT5_HOURS_PER_DAY, DEFAULT_MONTHLY_GPT5_HOURS_PER_DAY);
	return [
		{
			id: "thirty_minutes",
			name: "Upskillsafrica AI 30 Minutes",
			amountRwf: DEFAULT_THIRTY_MINUTES_AMOUNT_RWF,
			durationMs: 30 * 60 * 1000,
			gpt5DailyMsLimit: 30 * 60 * 1000,
			description: "3000 RWF starts 30 minutes of Upskillsafrica AI access.",
		},
		{
			id: "hourly",
			name: "Upskillsafrica AI Hour",
			amountRwf: parseInteger(env.SUBSCRIPTION_AMOUNT_RWF, DEFAULT_HOURLY_AMOUNT_RWF),
			durationMs: 60 * 60 * 1000,
			gpt5DailyMsLimit: 60 * 60 * 1000,
			description: "5000 RWF starts one hour of Upskillsafrica AI access.",
		},
		{
			id: "twelve_days",
			name: "Upskillsafrica AI 12 Days",
			amountRwf: DEFAULT_TWELVE_DAYS_AMOUNT_RWF,
			durationMs: 12 * 24 * 60 * 60 * 1000,
			gpt5DailyMsLimit: Math.min(monthlyGpt5Hours, 2) * 60 * 60 * 1000,
			description: "20000 RWF gives 12 days. gpt-5 is limited; use o3, gpt-4o-mini, and OpenRouter free models for the rest of the day.",
		},
		{
			id: "monthly",
			name: "Upskillsafrica AI Monthly",
			amountRwf: parseInteger(env.MONTHLY_SUBSCRIPTION_AMOUNT_RWF, DEFAULT_MONTHLY_AMOUNT_RWF),
			durationMs: monthlyDays * 24 * 60 * 60 * 1000,
			gpt5DailyMsLimit: monthlyGpt5Hours * 60 * 60 * 1000,
			description: "53000 RWF gives 30 days with gpt-5 limited to 5 hours/day; use other models for the rest of the day.",
		},
	];
}

function parsePlanId(value: unknown): PlanId | undefined {
	return value === "thirty_minutes" || value === "hourly" || value === "twelve_days" || value === "monthly"
		? value
		: undefined;
}

function getPlanByRequest(body: JsonObject, env: Env): PlanDefinition {
	const plans = getPlans(env);
	const requestedPlan = parsePlanId(body.plan);
	if (requestedPlan) return plans.find((plan) => plan.id === requestedPlan) || plans[0];
	const amount = readNumber(body.amount);
	if (amount) {
		return plans.find((plan) => plan.amountRwf === amount) || plans[0];
	}
	return plans[0];
}

function parseModelList(raw: string | undefined, source: ModelSource): ManagedModel[] {
	if (!raw) return [];
	try {
		const value = JSON.parse(raw);
		if (!Array.isArray(value)) return [];
		return value.flatMap((item): ManagedModel[] => {
			if (typeof item === "string") {
				return [
					{
						id: `${source}/${item}`,
						name: item,
						source,
						deployment: item,
						priceTier: source === "azure_models" ? "premium" : "free",
						capabilities: ["chat", "code"],
					},
				];
			}
			if (!isJsonObject(item)) return [];
			const id = readString(item.id);
			const name = readString(item.name) || id;
			const deployment = readString(item.deployment);
			const model = readString(item.model);
			const version = readString(item.version);
			const status = readString(item.status);
			const deploymentType = readString(item.deploymentType);
			const priceTier = readString(item.priceTier) === "premium" ? "premium" : "free";
			const requiresOrgCode = item.requiresOrgCode === true;
			const contextWindow = typeof item.contextWindow === "number" && item.contextWindow > 0 ? item.contextWindow : undefined;
			const maxTokens = typeof item.maxTokens === "number" && item.maxTokens > 0 ? item.maxTokens : undefined;
			const capabilities = Array.isArray(item.capabilities)
				? item.capabilities.filter((capability): capability is string => typeof capability === "string" && capability.trim().length > 0)
				: ["chat", "code"];
			if (!id || !name) return [];
			return [
				{
					id,
					name,
					source,
					deployment,
					model,
					version,
					status,
					deploymentType,
					priceTier,
					requiresOrgCode,
					contextWindow,
					maxTokens,
					capabilities: capabilities.length > 0 ? capabilities : ["chat", "code"],
				},
			];
		});
	} catch {
		return [];
	}
}

function getConfiguredModels(env: Env): ManagedModel[] {
	const azureModels = parseModelList(env.UPSKILLS_AZURE_MODELS, "azure_models");
	const openRouterModels = parseModelList(env.UPSKILLS_OPENROUTER_MODELS, "openrouter");
	const nvidiaModels = parseModelList(env.UPSKILLS_NVIDIA_MODELS, "nvidia");
	return [
		...(openRouterModels.length > 0 ? openRouterModels : DEFAULT_OPENROUTER_FREE_MODELS),
		...(azureModels.length > 0 ? azureModels.map((model) => ({ ...model, priceTier: "premium" as const })) : DEFAULT_AZURE_MODELS),
		...nvidiaModels.map((model) => ({ ...model, priceTier: "premium" as const })),
	];
}

async function getDbModels(env: Env): Promise<ManagedModel[]> {
	if (!env.DATABASE_URL) return [];
	try {
		const sql = getSql(env);
		const rows = await sql`
			select id, display_name, source, provider_model_id, deployment, version, price_tier, capabilities, metadata
			from ai_models
			where is_active = true
			order by price_tier, id
		`;
		return rows.flatMap((row): ManagedModel[] => {
			const id = readString(row.id);
			const name = readString(row.display_name) || id;
			const source = readString(row.source) === "openrouter" ? "openrouter" : readString(row.source) === "azure_models" ? "azure_models" : undefined;
			const priceTier = readString(row.price_tier) === "free" ? "free" : "premium";
			if (!id || !name || !source) return [];
			const metadata = isJsonObject(row.metadata) ? row.metadata : {};
			const capabilities = Array.isArray(row.capabilities)
				? row.capabilities.filter((capability): capability is string => typeof capability === "string" && capability.trim().length > 0)
				: ["chat", "code"];
			return [
				{
					id,
					name,
					source,
					priceTier,
					capabilities: capabilities.length > 0 ? capabilities : ["chat", "code"],
					deployment: readString(row.deployment) || readString(row.provider_model_id),
					model: readString(row.provider_model_id) || id,
					version: readString(row.version),
					status: readString(metadata.status),
					deploymentType: readString(metadata.deploymentType),
					requiresOrgCode: metadata.requiresOrgCode === true,
				},
			];
		});
	} catch {
		return [];
	}
}

async function getModels(env: Env): Promise<ManagedModel[]> {
	const configuredModels = getConfiguredModels(env);
	const dbModels = await getDbModels(env);
	const byId = new Map<string, ManagedModel>();
	for (const model of dbModels) byId.set(model.id, model);
	for (const model of configuredModels) {
		if (!byId.has(model.id)) byId.set(model.id, model);
	}
	return [...byId.values()];
}

function handlePlans(env: Env): Response {
	return cachedJson({ currency: "RWF", plans: getPlans(env) }, 300);
}

async function handleModels(env: Env): Promise<Response> {
	const models = await getModels(env);
	return cachedJson(
		{
			provider: "Upskillsafrica AI",
			azureProjectEndpoint: env.AZURE_AI_PROJECT_ENDPOINT || DEFAULT_AZURE_PROJECT_ENDPOINT,
			models: models.map((model) => ({
				...model,
				contextWindow: model.contextWindow ?? 128000,
				maxTokens: model.maxTokens ?? getModelUsagePolicy(model)?.hardMaxTokens ?? 16384,
			})),
			groups: {
				openrouterFree: models.filter((model) => model.source === "openrouter" && model.priceTier === "free"),
				azurePremium: models.filter((model) => model.source === "azure_models"),
			},
		},
		300,
	);
}

async function createSession(userId: string, request: Request, env: Env): Promise<{ token: string; expiresAt: string }> {
	const sql = getSql(env);
	const token = randomToken();
	const tokenHash = await sha256Base64(token);
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
	await sql`
		insert into auth_sessions (token_hash, user_id, expires_at, user_agent)
		values (${tokenHash}, ${userId}, ${expiresAt}, ${request.headers.get("user-agent") || "gihanga-tui"})
	`;
	return { token, expiresAt };
}

async function handleRegister(request: Request, env: Env): Promise<Response> {
	const body = await readJsonObject(request);
	const emailRaw = readString(body.email);
	if (!emailRaw) return json({ message: "email is required." }, 400);
	const email = normalizeEmail(emailRaw);
	const passwordValue = requirePassword(readString(body.password));
	if (passwordValue instanceof Response) return passwordValue;
	const confirmPassword = readString(body.confirmPassword);
	if (passwordValue !== confirmPassword) return json({ message: "Password confirmation does not match." }, 400);
	const sql = getSql(env);
	const existing = await sql`select id from users where email = ${email} limit 1`;
	if (existing.length > 0) return json({ message: "Account already exists. Login instead." }, 409);
	const salt = randomToken(18);
	const passwordHash = await hashPassword(passwordValue, salt);
	const rows = await sql`
		insert into users (email, password_hash, password_salt)
		values (${email}, ${passwordHash}, ${salt})
		returning id, email
	`;
	const user = rowToAuthUser(rows[0]);
	const session = await createSession(user.id, request, env);
	return json({ user, ...session });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
	const body = await readJsonObject(request);
	const emailRaw = readString(body.email);
	const password = readString(body.password);
	if (!emailRaw || !password) return json({ message: "email and password are required." }, 400);
	const email = normalizeEmail(emailRaw);
	const sql = getSql(env);
	const rows = await sql`select id, email, password_hash, password_salt, is_active from users where email = ${email} limit 1`;
	if (rows.length === 0 || rows[0].is_active !== true) return json({ message: "Invalid email or password." }, 401);
	const expected = readString(rows[0].password_hash);
	const salt = readString(rows[0].password_salt);
	if (!expected || !salt || (await hashPassword(password, salt)) !== expected) return json({ message: "Invalid email or password." }, 401);
	const user = rowToAuthUser(rows[0]);
	await sql`update users set last_login_at = now(), updated_at = now() where id = ${user.id}`;
	const session = await createSession(user.id, request, env);
	return json({ user, ...session });
}

async function handleMe(request: Request, env: Env): Promise<Response> {
	const user = await getUserFromRequest(request, env);
	if (!user) return json({ message: "Login required." }, 401);
	const entitlements = await getAccountEntitlements(user.id, env);
	return json({ user, entitlements, models: await getModels(env), plans: getPlans(env) });
}

async function handleOrgCodeVerify(request: Request, env: Env): Promise<Response> {
	if (!env.DATABASE_URL) return json({ message: "Organisation-code database is not configured." }, 503);
	const user = await getUserFromRequest(request, env);
	if (!user) return json({ message: "Login required." }, 401);
	const body = await readJsonObject(request);
	const organisationCode = readString(body.organisationCode) || readString(body.organizationCode) || readString(body.code);
	if (!organisationCode) return json({ message: "organisationCode is required." }, 400);

	const codeHash = await sha256Base64(organisationCode);
	const sql = getSql(env);
	const rows = await sql`
		select code_hash, label, max_users, expires_at
		from organisation_codes
		where code_hash = ${codeHash}
			and is_active = true
			and (expires_at is null or expires_at > now())
		limit 1
	`;
	if (rows.length === 0) return json({ ok: false, message: "Invalid or expired organisation code." }, 404);

	const code = rows[0];
	const alreadyAssigned = await sql`
		select 1
		from user_organisation_codes
		where user_id = ${user.id} and code_hash = ${codeHash}
		limit 1
	`;
	if (alreadyAssigned.length === 0 && typeof code.max_users === "number" && code.max_users > 0) {
		const countRows = await sql`
			select count(*)::int as user_count
			from user_organisation_codes
			where code_hash = ${codeHash}
		`;
		const userCount = Number(countRows[0]?.user_count ?? 0);
		if (userCount >= code.max_users) {
			return json({ ok: false, message: "Organisation code user limit reached." }, 409);
		}
	}

	await sql`
		insert into user_organisation_codes (user_id, code_hash)
		values (${user.id}, ${codeHash})
		on conflict (user_id, code_hash) do nothing
	`;

	return json({
		ok: true,
		assigned: true,
		label: readString(code.label) || "Upskillsafrica organisation",
		expiresAt: code.expires_at ?? null,
	});
}

function getRealtimeModels(env: Env): string[] {
	const raw = env.UPSKILLS_REALTIME_MODELS?.trim();
	if (!raw) return env.UPSKILLS_REALTIME_MODEL ? [env.UPSKILLS_REALTIME_MODEL] : [];
	try {
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed.filter((model): model is string => typeof model === "string" && model.trim().length > 0);
	} catch {
		return raw.split(",").map((model) => model.trim()).filter(Boolean);
	}
	return [];
}

async function getPaidRealtimeUser(request: Request, env: Env): Promise<{ user: AuthUser; entitlement: AccountEntitlementRecord } | Response> {
	const user = await getUserFromRequest(request, env);
	if (!user) return json({ message: "Login required." }, 401);
	const entitlement = await getActiveAccountEntitlement(user.id, env);
	if (!entitlement) return json({ message: "Active Upskillsafrica subscription required for realtime voice." }, 402);
	return { user, entitlement };
}

async function handleRealtimeModels(request: Request, env: Env): Promise<Response> {
	const access = await getPaidRealtimeUser(request, env);
	if (access instanceof Response) return access;
	return json({ provider: "Upskillsafrica AI realtime", models: getRealtimeModels(env), entitlement: accountToEntitlement(access.entitlement) });
}

async function handleRealtimeWebSocket(request: Request, env: Env): Promise<Response> {
	const access = await getPaidRealtimeUser(request, env);
	if (access instanceof Response) return access;
	if (!env.AZURE_REALTIME_ENDPOINT || !env.AZURE_REALTIME_API_KEY) {
		return json({ message: "Realtime voice is not configured." }, 503);
	}
	const configuredModels = getRealtimeModels(env);
	const requestedModel = new URL(request.url).searchParams.get("model") || configuredModels[0];
	if (!requestedModel) return json({ message: "No realtime Azure deployment is configured." }, 503);
	if (configuredModels.length > 0 && !configuredModels.includes(requestedModel)) {
		return json({ message: "Requested realtime model is not available." }, 400);
	}
	const upstreamUrl = `${env.AZURE_REALTIME_ENDPOINT.replace(/\/$/, "")}/openai/v1/realtime?model=${encodeURIComponent(requestedModel)}`;
	const upstreamHeaders = new Headers(request.headers);
	upstreamHeaders.delete("authorization");
	upstreamHeaders.set("api-key", env.AZURE_REALTIME_API_KEY);
	upstreamHeaders.set("upgrade", "websocket");
	return fetch(new Request(upstreamUrl, { method: "GET", headers: upstreamHeaders }));
}

async function handleRealtimeClientSecrets(request: Request, env: Env): Promise<Response> {
	const access = await getPaidRealtimeUser(request, env);
	if (access instanceof Response) return access;
	if (!env.AZURE_REALTIME_ENDPOINT || !env.AZURE_REALTIME_API_KEY) {
		return json({ message: "Realtime voice is not configured." }, 503);
	}
	const body = await readJsonObject(request);
	const requestedModel = readString(body.model);
	const configuredModels = getRealtimeModels(env);
	const model = requestedModel || configuredModels[0];
	if (!model) return json({ message: "No realtime Azure deployment is configured." }, 503);
	if (configuredModels.length > 0 && !configuredModels.includes(model)) {
		return json({ message: "Requested realtime model is not available." }, 400);
	}
	const endpoint = env.AZURE_REALTIME_ENDPOINT.replace(/\/$/, "");
	const providerResponse = await fetch(`${endpoint}/openai/v1/realtime/client_secrets`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "api-key": env.AZURE_REALTIME_API_KEY },
		body: JSON.stringify({
			session: {
				type: "realtime",
				model,
				output_modalities: ["audio"],
			},
		}),
	});
	const providerBody = await safeReadJson(providerResponse);
	if (!providerResponse.ok) {
		return json({ message: "Azure realtime voice is unavailable for this deployment.", providerStatus: providerResponse.status }, 502);
	}
	const value = readString(providerBody.value) || readString(providerBody.client_secret);
	if (!value) return json({ message: "Azure realtime did not return a client secret." }, 502);
	return json({ value, expiresAt: providerBody.expires_at || null, model });
}

function rowToAuthUser(row: SqlRow): AuthUser {
	const id = readString(row.id);
	const email = readString(row.email);
	if (!id || !email) throw new Error("Invalid user row.");
	return { id, email };
}

async function getUserFromRequest(request: Request, env: Env): Promise<AuthUser | undefined> {
	return (await getAuthenticatedAccessFromRequest(request, env))?.user;
}

function rowToAccountEntitlement(row: SqlRow): AccountEntitlementRecord | undefined {
	const receiptRef = readString(row.receipt_ref) || readString(row.receiptRef);
	const planId = parsePlanId(row.plan_id) || parsePlanId(row.planId);
	const amountRwf = readNumber(row.amount_rwf) || readNumber(row.amountRwf);
	const status = readString(row.status);
	const startsAt = readDateString(row.starts_at) || readDateString(row.startsAt);
	const expiresAt = readDateString(row.expires_at) || readDateString(row.expiresAt);
	const gpt5DailyMinutes = readNumber(row.gpt5_daily_minutes);
	const gpt5DailyMsLimit = gpt5DailyMinutes === undefined ? readNumber(row.gpt5DailyMsLimit) : gpt5DailyMinutes * 60 * 1000;
	if (!receiptRef || !planId || !amountRwf || !status || !startsAt || !expiresAt || gpt5DailyMsLimit === undefined) return undefined;
	return { receiptRef, planId, amountRwf, status, startsAt, expiresAt, gpt5DailyMsLimit };
}

async function getAuthenticatedAccessFromRequest(request: Request, env: Env): Promise<AuthenticatedAccess | undefined> {
	const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	if (!token) return undefined;
	const tokenHash = await sha256Base64(token);
	const cachedAccess = await getCachedAuthenticatedAccess(tokenHash, env);
	if (cachedAccess) return cachedAccess;
	const sql = getSql(env);
	const rows = await sql`
		select u.id, u.email, ae.receipt_ref, ae.plan_id, ae.amount_rwf, ae.status, ae.starts_at, ae.expires_at, ae.gpt5_daily_minutes
		from auth_sessions s
		join users u on u.id = s.user_id
		left join lateral (
			select receipt_ref, plan_id, amount_rwf, status, starts_at, expires_at, gpt5_daily_minutes
			from account_entitlements
			where user_id = u.id and expires_at > now()
			order by expires_at desc
			limit 1
		) ae on true
		where s.token_hash = ${tokenHash}
			and s.revoked_at is null
			and s.expires_at > now()
			and u.is_active = true
		limit 1
	`;
	if (rows.length === 0) return undefined;
	await sql`update auth_sessions set last_seen_at = now() where token_hash = ${tokenHash}`;
	const access = { user: rowToAuthUser(rows[0]), entitlement: rowToAccountEntitlement(rows[0]) };
	await cacheAuthenticatedAccess(tokenHash, access, env);
	return access;
}

async function getCachedAuthenticatedAccess(tokenHash: string, env: Env): Promise<AuthenticatedAccess | undefined> {
	const raw = await env.ENTITLEMENTS.get(`auth-cache:${tokenHash}`);
	if (!raw) return undefined;
	try {
		const value = JSON.parse(raw);
		if (!isJsonObject(value) || !isJsonObject(value.user)) return undefined;
		const id = readString(value.user.id);
		const email = readString(value.user.email);
		if (!id || !email) return undefined;
		const entitlementValue = isJsonObject(value.entitlement) ? value.entitlement : undefined;
		const entitlement = entitlementValue ? rowToAccountEntitlement(entitlementValue) : undefined;
		if (entitlement && Date.parse(entitlement.expiresAt) <= Date.now()) return undefined;
		return { user: { id, email }, entitlement };
	} catch {
		return undefined;
	}
}

async function cacheAuthenticatedAccess(tokenHash: string, access: AuthenticatedAccess, env: Env): Promise<void> {
	await env.ENTITLEMENTS.put(`auth-cache:${tokenHash}`, JSON.stringify(access), { expirationTtl: 60 });
}

async function getAccountEntitlements(userId: string, env: Env): Promise<AccountEntitlementRecord[]> {
	const sql = getSql(env);
	const rows = await sql`
		select receipt_ref, plan_id, amount_rwf, status, starts_at, expires_at, gpt5_daily_minutes
		from account_entitlements
		where user_id = ${userId} and expires_at > now()
		order by expires_at desc
	`;
	return rows.flatMap((row): AccountEntitlementRecord[] => {
		const entitlement = rowToAccountEntitlement(row);
		return entitlement ? [entitlement] : [];
	});
}

async function getActiveAccountEntitlement(userId: string, env: Env): Promise<AccountEntitlementRecord | undefined> {
	return (await getAccountEntitlements(userId, env))[0];
}

function accountToEntitlement(record: AccountEntitlementRecord): EntitlementRecord {
	return {
		ref: record.receiptRef,
		planId: record.planId,
		amountRwf: record.amountRwf,
		status: record.status,
		createdAt: record.startsAt,
		expiresAt: record.expiresAt,
		gpt5DailyMsLimit: record.gpt5DailyMsLimit,
	};
}

function getPaymentWorkerUrl(env: Env, path: string): string {
	const baseUrl = env.PAYMENT_WORKER_URL || "https://payment-worker.local";
	return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function callPaymentWorker(env: Env, path: string, init?: RequestInit): Promise<Response> {
	const url = getPaymentWorkerUrl(env, path);
	if (env.PAYMENT_WORKER) {
		return env.PAYMENT_WORKER.fetch(new Request(url, init));
	}
	if (!env.PAYMENT_WORKER_URL) {
		return json({ message: "Payment worker is not configured." }, 503);
	}
	return fetch(url, init);
}

async function handleSubscriptionStart(request: Request, env: Env): Promise<Response> {
	if (!env.PAYMENT_WORKER_URL) {
		return json({ message: "Payment worker is not configured." }, 503);
	}
	const body = await readJsonObject(request);
	const user = await getUserFromRequest(request, env);
	const phone = readString(body.phone);
	if (!phone) {
		return json({ message: "phone is required." }, 400);
	}
	const activeEntitlement = user ? await getActiveAccountEntitlement(user.id, env) : undefined;
	if (activeEntitlement) {
		return json(
			{
				message: "Active Upskillsafrica subscription already exists. Choose a model to continue.",
				entitlement: accountToEntitlement(activeEntitlement),
				models: await getModels(env),
			},
			409,
		);
	}
	const plan = getPlanByRequest(body, env);
	const transactionRef = readString(body.transactionRef) || createTransactionRef(plan.id);
	const pendingRecord: PendingSubscriptionRecord = {
		ref: transactionRef,
		planId: plan.id,
		amountRwf: plan.amountRwf,
		phone,
		createdAt: new Date().toISOString(),
	};
	await env.ENTITLEMENTS.put(`pending:${transactionRef}`, JSON.stringify(pendingRecord), { expirationTtl: 24 * 60 * 60 });
	if (user) {
		const sql = getSql(env);
		await sql`
			insert into pending_subscriptions (transaction_ref, plan_id, phone, amount_rwf, user_id)
			values (${transactionRef}, ${plan.id}, ${phone}, ${plan.amountRwf}, ${user.id})
			on conflict (transaction_ref) do update set
				plan_id = excluded.plan_id,
				phone = excluded.phone,
				amount_rwf = excluded.amount_rwf,
				user_id = excluded.user_id,
				updated_at = now()
		`;
	}
	if (env.TEST_PAYMENT_BYPASS_PHONE && phone === env.TEST_PAYMENT_BYPASS_PHONE) {
		const entitlement = await storeEntitlement(transactionRef, "test_bypass", env);
		return json({
			transactionRef,
			plan,
			entitlement,
			payment: { status: "test_bypass", message: "Test number bypassed payment for Upskillsafrica QA." },
		});
	}
	const response = await callPaymentWorker(env, "/pay", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ amount: plan.amountRwf, phone, transactionRef }),
	});
	const paymentBody = await safeReadJson(response);
	const paymentRef = readString(paymentBody.ref);
	const receiptRef = response.ok && paymentRef ? paymentRef : transactionRef;
	if (response.ok && paymentRef && paymentRef !== transactionRef) {
		await env.ENTITLEMENTS.put(`pending:${paymentRef}`, JSON.stringify({ ...pendingRecord, ref: paymentRef }), { expirationTtl: 24 * 60 * 60 });
		if (user) {
			const sql = getSql(env);
			await sql`
				insert into pending_subscriptions (transaction_ref, plan_id, phone, amount_rwf, user_id)
				values (${paymentRef}, ${plan.id}, ${phone}, ${plan.amountRwf}, ${user.id})
				on conflict (transaction_ref) do update set
					plan_id = excluded.plan_id,
					phone = excluded.phone,
					amount_rwf = excluded.amount_rwf,
					user_id = excluded.user_id,
					updated_at = now()
			`;
		}
	}
	if (!response.ok) {
		return json(
			{
				transactionRef: receiptRef,
				merchantTransactionRef: transactionRef,
				plan,
				payment: paymentBody,
				message: readString(paymentBody.message) || readString(paymentBody.text) || "Payment request failed.",
			},
			response.status,
		);
	}
	return json({ transactionRef: receiptRef, merchantTransactionRef: transactionRef, plan, payment: paymentBody });
}

async function handleTerminalPay(request: Request, env: Env): Promise<Response> {
	return handleSubscriptionStart(request, env);
}

async function handleCredits(receiptRef: string, env: Env): Promise<Response> {
	if (!receiptRef) {
		return json({ message: "receipt reference is required." }, 400);
	}
	const entitlement = await getValidEntitlement(receiptRef, env);
	if (!entitlement) {
		return json({ receiptRef, active: false, message: "No active credits found for this receipt." }, 404);
	}
	const usage = await getDailyUsage(receiptRef, env);
	return json({
		receiptRef,
		active: true,
		entitlement,
		gpt5Daily: {
			usedMs: usage.gpt5Ms,
			limitMs: entitlement.gpt5DailyMsLimit,
			remainingMs: Math.max(0, entitlement.gpt5DailyMsLimit - usage.gpt5Ms),
			usageDate: usage.date,
		},
		models: await getModels(env),
	});
}

async function handleSubscriptionVerify(transactionRef: string, env: Env): Promise<Response> {
	if (!transactionRef) {
		return json({ message: "transactionRef is required." }, 400);
	}
	if (!env.PAYMENT_WORKER_URL) {
		return json({ message: "Payment worker is not configured." }, 503);
	}
	const response = await callPaymentWorker(env, `/verify/${encodeURIComponent(transactionRef)}`, { headers: { Accept: "application/json" } });
	const payment = await safeReadJson(response);
	const status = readString(payment.status) || "pending";
	if (response.ok && isPaidStatus(status)) {
		const record = await storeEntitlement(transactionRef, status, env);
		return json({ transactionRef, status, entitlement: record });
	}
	return json({ transactionRef, status, payment }, response.ok ? 200 : response.status);
}

function resolveUpskillsafricaModelAlias(modelId: string | undefined): string | undefined {
	if (!modelId) return undefined;
	const aliases: Record<string, string> = {
		"google/gemma-4-26b-a4b-it": "openrouter/google/gemma-4-26b-a4b-it:free",
		"google/gemma-4-31b-it": "openrouter/google/gemma-4-31b-it:free",
		"nvidia/nemotron-3-nano-30b-a3b": "openrouter/nvidia/nemotron-3-nano-30b-a3b:free",
		"nvidia/nemotron-3-nano-omni-30b-a3b-reasoning": "openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
		"nvidia/nemotron-3-super-120b-a12b": "openrouter/nvidia/nemotron-3-super-120b-a12b:free",
		"nvidia/nemotron-3-ultra-550b-a55b": "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free",
		"nvidia/nemotron-nano-12b-v2-vl": "openrouter/nvidia/nemotron-nano-12b-v2-vl:free",
		"openai/gpt-oss-120b": "openrouter/openai/gpt-oss-120b:free",
	};
	return aliases[modelId] || modelId;
}

function isOpenRouterRoutableModelId(modelId: string): boolean {
	return modelId.startsWith("openrouter/");
}



async function handleChatCompletions(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
	const receiptHeader = request.headers.get("x-upskillsafrica-receipt");
	const authAccess = await getAuthenticatedAccessFromRequest(request, env);
	const authUser = authAccess?.user;
	const body = await readJsonObject(request);
	const modelId = resolveUpskillsafricaModelAlias(readString(body.model));
	if (!modelId) {
		return openAiError("model is required.", 400, "model_required");
	}
	const models = await getModels(env);
	let model = models.find((candidate) => candidate.id === modelId);
	if (!model && isOpenRouterRoutableModelId(modelId)) {
		const openRouterId = modelId.startsWith("openrouter/") ? modelId : `openrouter/${modelId}`;
		model = {
			id: openRouterId,
			name: modelId,
			source: "openrouter",
			priceTier: "premium",
			capabilities: ["chat", "code"],
		};
	}
	if (!model) {
		return openAiError("Unknown Upskillsafrica AI model.", 400, "unknown_model");
	}

	const hasOrgAccess = requiresOrganisationAccess(model) ? await hasValidOrgCode(request, body, env, authUser) : false;
	if (requiresOrganisationAccess(model) && !hasOrgAccess) {
		return openAiError(
			`This Upskillsafrica model (${model.id}) requires an organisation code. Run /kwinjira, choose "Add organisation code", then try again.`,
			403,
			"organisation_code_required",
		);
	}

	const accountEntitlement = authAccess?.entitlement;
	const receiptEntitlement = receiptHeader ? await getValidEntitlement(receiptHeader, env) : undefined;
	const paidEntitlement = accountEntitlement ? accountToEntitlement(accountEntitlement) : receiptEntitlement;
	const entitlement = paidEntitlement || (hasOrgAccess ? createOrganisationCodeEntitlement(authUser) : undefined);
	if (!entitlement) {
		return openAiError(
			"Upskillsafrica subscription or organisation access is required. Run /kwinjira to login, then use /org add <code> or complete payment from the console.",
			402,
			"subscription_required",
		);
	}

	const applyPaidSafeguards = !hasOrgAccess && !isOrganisationCodeEntitlement(entitlement);
	let routedModel = model;
	let quota = await assertModelQuota(entitlement, routedModel, env, applyPaidSafeguards);
	if (quota.limited && applyPaidSafeguards) {
		const fallback = findLowerCostFallbackModel(routedModel, models);
		if (fallback) {
			routedModel = fallback;
			quota = await assertModelQuota(entitlement, routedModel, env, applyPaidSafeguards);
		}
	}
	if (quota.limited) {
		return openAiError(quota.message || `Daily limit reached for ${routedModel.id}.`, 429, "daily_model_limit_reached");
	}
	const routedBody = applyPaidSafeguards ? applyModelMaxTokenPolicy(body, routedModel) : body;
	const startedAt = Date.now();
	const upstreamResponse = routedModel.source === "openrouter"
		? await routeOpenRouter(routedBody, routedModel, env)
		: routedModel.source === "nvidia"
			? await routeNvidia(routedBody, routedModel, env)
			: await routeAzure(routedBody, routedModel, env);
	const response = await normalizeProviderResponse(upstreamResponse, routedModel);
	if (response.ok && (quota.trackGpt5 || quota.trackModelRequests)) {
		const elapsedMs = Date.now() - startedAt;
		ctx.waitUntil(recordModelUsage(entitlement, routedModel, elapsedMs, quota, authUser, env));
	}
	return response;
}

function createOrganisationCodeEntitlement(user?: AuthUser): EntitlementRecord {
	const now = new Date();
	const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);
	return {
		ref: user ? `org-code:${user.id}` : "org-code:anonymous",
		planId: "monthly",
		amountRwf: 0,
		status: "organisation_code",
		createdAt: now.toISOString(),
		expiresAt: expires.toISOString(),
		gpt5DailyMsLimit: 24 * 60 * 60 * 1000,
	};
}

async function normalizeProviderResponse(response: Response, model: ManagedModel): Promise<Response> {
	if (response.ok) return response;
	const contentType = response.headers.get("content-type") || "";
	const bodyText = await response.text().catch(() => "");
	if (bodyText.trim()) {
		const headers = new Headers({ ...corsHeaders(), "Content-Type": contentType || "application/json" });
		return new Response(bodyText, { status: response.status, headers });
	}
	const code = response.status === 402 ? "provider_payment_required" : "provider_error";
	const message =
		response.status === 402
			? `The upstream provider rejected ${model.id} with HTTP 402/payment required. Try a free model, choose another Upskillsafrica model, or contact Upskillsafrica support to refresh provider credits.`
			: `The upstream provider rejected ${model.id} with HTTP ${response.status}.`;
	return openAiError(message, response.status, code);
}

async function hasValidOrgCode(request: Request, body: JsonObject, env: Env, user?: AuthUser): Promise<boolean> {
	if (!env.DATABASE_URL) return false;
	const provided = request.headers.get("x-upskillsafrica-org-code") || readString(body.organisationCode) || readString(body.organizationCode);
	const sql = getSql(env);
	if (provided) {
		const codeHash = await sha256Base64(provided);
		const rows = await sql`
			select code_hash
			from organisation_codes
			where code_hash = ${codeHash}
				and is_active = true
				and (expires_at is null or expires_at > now())
			limit 1
		`;
		if (rows.length > 0) return true;
	}
	if (!user) return false;
	const assignedRows = await sql`
		select oc.code_hash
		from user_organisation_codes uoc
		join organisation_codes oc on oc.code_hash = uoc.code_hash
		where uoc.user_id = ${user.id}
			and oc.is_active = true
			and (oc.expires_at is null or oc.expires_at > now())
		limit 1
	`;
	return assignedRows.length > 0;
}

async function assertModelQuota(
	entitlement: EntitlementRecord,
	model: ManagedModel,
	env: Env,
	applyPaidSafeguards: boolean,
): Promise<ModelQuotaResult> {
	const trackGpt5 = isGpt5Model(model);
	const policy = applyPaidSafeguards ? getModelUsagePolicy(model) : undefined;
	if (!trackGpt5 && !policy) {
		return { trackGpt5: false, trackModelRequests: false };
	}
	const usage = await getDailyUsage(entitlement.ref, env);
	if (trackGpt5 && usage.gpt5Ms >= entitlement.gpt5DailyMsLimit) {
		return {
			trackGpt5,
			trackModelRequests: Boolean(policy),
			limited: true,
			message: "Daily gpt-5 limit reached. Use o3, gpt-4o-mini, or OpenRouter free models until reset tomorrow.",
		};
	}
	if (policy) {
		const usedRequests = usage.modelRequests[model.id] || 0;
		const dailyLimit = policy.dailyRequests[entitlement.planId];
		if (usedRequests >= dailyLimit) {
			return {
				trackGpt5,
				trackModelRequests: true,
				limited: true,
				message: `Daily limit reached for ${model.id} on the ${entitlement.planId} plan. Use a lower-cost Upskillsafrica model or try again tomorrow.`,
			};
		}
	}
	return { trackGpt5, trackModelRequests: Boolean(policy) };
}

function isGpt5Model(model: ManagedModel): boolean {
	return model.id.includes("gpt-5") || model.deployment === "gpt-5" || model.model === "gpt-5";
}

function isOrganisationCodeEntitlement(entitlement: EntitlementRecord): boolean {
	return entitlement.status === "organisation_code" || entitlement.ref.startsWith("org-code:");
}

function getModelUsagePolicy(model: ManagedModel): ModelUsagePolicy | undefined {
	if (model.priceTier === "free") return undefined;
	if (model.source === "nvidia" || model.id === "uaf_model_three_best") return NVIDIA_ULTRA_POLICY;
	if (isGpt5Model(model) || model.id === "o3" || model.deployment === "o3" || model.capabilities.includes("reasoning")) return REASONING_PREMIUM_POLICY;
	return STANDARD_PREMIUM_POLICY;
}

function applyModelMaxTokenPolicy(body: JsonObject, model: ManagedModel): JsonObject {
	const policy = getModelUsagePolicy(model);
	if (!policy) return body;
	const next: JsonObject = { ...body, model: model.id };
	const requestedMaxTokens = readNumber(next.max_tokens);
	const requestedMaxCompletionTokens = readNumber(next.max_completion_tokens);
	if (requestedMaxTokens === undefined && requestedMaxCompletionTokens === undefined) {
		next.max_tokens = policy.defaultMaxTokens;
		return next;
	}
	if (requestedMaxTokens !== undefined) {
		next.max_tokens = Math.max(1, Math.min(Math.floor(requestedMaxTokens), policy.hardMaxTokens));
	}
	if (requestedMaxCompletionTokens !== undefined) {
		next.max_completion_tokens = Math.max(1, Math.min(Math.floor(requestedMaxCompletionTokens), policy.hardMaxTokens));
	}
	return next;
}

function findLowerCostFallbackModel(model: ManagedModel, models: ManagedModel[]): ManagedModel | undefined {
	const candidates = [
		"gpt-4o",
		"openrouter/free",
		"openrouter/openai/gpt-oss-120b:free",
		"openrouter/qwen/qwen3-next-80b-a3b-instruct:free",
		"openrouter/google/gemma-4-26b-a4b-it:free",
	];
	return candidates.map((id) => models.find((candidate) => candidate.id === id)).find((candidate): candidate is ManagedModel => Boolean(candidate) && candidate.id !== model.id);
}

async function routeNvidia(body: JsonObject, model: ManagedModel, env: Env): Promise<Response> {
	if (!env.NVIDIA_API_KEY) return json({ message: "NVIDIA API is not configured." }, 503);
	const endpoint = (env.NVIDIA_API_ENDPOINT || DEFAULT_NVIDIA_API_ENDPOINT).replace(/\/$/, "");
	const upstreamBody: JsonObject = { ...body, model: model.model || model.deployment || model.id };
	return fetch(`${endpoint}/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env.NVIDIA_API_KEY}`,
		},
		body: JSON.stringify(upstreamBody),
	});
}

async function routeOpenRouter(body: JsonObject, model: ManagedModel, env: Env): Promise<Response> {
	if (!env.OPENROUTER_API_KEY) {
		return json({ message: "OpenRouter is not configured." }, 503);
	}
	const upstreamModelId = model.id === "openrouter/free" ? model.id : model.id.replace(/^openrouter\//, "");
	const upstreamBody = { ...body, model: upstreamModelId };
	return fetch("https://openrouter.ai/api/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
			"HTTP-Referer": "https://console.upskillsafrica.org",
			"X-Title": "Upskillsafrica AI",
		},
		body: JSON.stringify(upstreamBody),
	});
}

function usesMaxCompletionTokens(deployment: string): boolean {
	return deployment.startsWith("gpt-5") || deployment.startsWith("o1") || deployment.startsWith("o3") || deployment.startsWith("o4");
}

function requiresOrganisationAccess(model: ManagedModel): boolean {
	return (
		model.requiresOrgCode === true ||
		ORG_REQUIRED_MODEL_IDS.has(model.id) ||
		(model.deployment ? ORG_REQUIRED_MODEL_IDS.has(model.deployment) : false) ||
		(model.model ? ORG_REQUIRED_MODEL_IDS.has(model.model) : false)
	);
}

async function routeAzure(body: JsonObject, model: ManagedModel, env: Env): Promise<Response> {
	const usesOrganisationAzure = requiresOrganisationAccess(model);
	const apiKey = usesOrganisationAzure ? env.ORG_AZURE_OPENAI_API_KEY : env.AZURE_OPENAI_API_KEY;
	if (!apiKey) {
		return json({ message: "Azure OpenAI is not configured." }, 503);
	}
	const deployment = model.deployment || model.id.replace(/^azure_models\//, "");
	const apiVersion = env.AZURE_OPENAI_API_VERSION || "2024-10-21";
	const endpoint = (usesOrganisationAzure
		? env.ORG_AZURE_OPENAI_ENDPOINT || DEFAULT_ORG_AZURE_ENDPOINT
		: env.AZURE_OPENAI_ENDPOINT || DEFAULT_AZURE_ENDPOINT
	).replace(/\/$/, "");
	const azureBody: JsonObject = { ...body, model: deployment };
	delete azureBody.organisationCode;
	delete azureBody.organizationCode;
	delete azureBody.reasoning_effort;
	delete azureBody.reasoning;
	if (usesMaxCompletionTokens(deployment)) {
		const requestedMaxTokens = readNumber(azureBody.max_tokens);
		if (requestedMaxTokens !== undefined && azureBody.max_completion_tokens === undefined) {
			azureBody.max_completion_tokens = requestedMaxTokens;
		}
		delete azureBody.max_tokens;
	}
	const url = endpoint.endsWith("/openai/v1")
		? `${endpoint}/chat/completions`
		: `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
	return fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/json", "api-key": apiKey },
		body: JSON.stringify(azureBody),
	});
}

async function getPendingSubscription(ref: string, env: Env): Promise<PendingSubscriptionRecord | undefined> {
	const raw = await env.ENTITLEMENTS.get(`pending:${ref}`);
	if (!raw) return undefined;
	try {
		const value = JSON.parse(raw);
		if (!isJsonObject(value)) return undefined;
		const planId = parsePlanId(value.planId);
		const amountRwf = readNumber(value.amountRwf);
		const phone = readString(value.phone);
		const createdAt = readString(value.createdAt);
		if (!planId || !amountRwf || !phone || !createdAt) return undefined;
		return { ref, planId, amountRwf, phone, createdAt };
	} catch {
		return undefined;
	}
}

async function storeEntitlement(ref: string, status: string, env: Env): Promise<EntitlementRecord> {
	const pending = await getPendingSubscription(ref, env);
	const plans = getPlans(env);
	const plan = plans.find((candidate) => candidate.id === pending?.planId) || plans[0];
	const now = new Date();
	const expires = new Date(now.getTime() + plan.durationMs);
	const record: EntitlementRecord = {
		ref,
		planId: plan.id,
		amountRwf: plan.amountRwf,
		status,
		createdAt: now.toISOString(),
		expiresAt: expires.toISOString(),
		gpt5DailyMsLimit: plan.gpt5DailyMsLimit,
	};
	await env.ENTITLEMENTS.put(`receipt:${ref}`, JSON.stringify(record), { expirationTtl: Math.ceil((expires.getTime() - now.getTime()) / 1000) });
	if (env.DATABASE_URL) {
		const sql = getSql(env);
		const pendingRows = await sql`select user_id from pending_subscriptions where transaction_ref = ${ref} limit 1`;
		const userId = readString(pendingRows[0]?.user_id);
		if (userId) {
			await sql`
				insert into account_entitlements (user_id, receipt_ref, transaction_ref, plan_id, amount_rwf, status, starts_at, expires_at, gpt5_daily_minutes)
				values (${userId}, ${ref}, ${ref}, ${plan.id}, ${plan.amountRwf}, ${status}, ${now.toISOString()}, ${expires.toISOString()}, ${Math.floor(plan.gpt5DailyMsLimit / 60000)})
				on conflict (receipt_ref) do update set
					status = excluded.status,
					expires_at = excluded.expires_at,
					gpt5_daily_minutes = excluded.gpt5_daily_minutes,
					updated_at = now()
			`;
		}
	}
	return record;
}

async function getValidEntitlement(ref: string, env: Env): Promise<EntitlementRecord | undefined> {
	const raw = await env.ENTITLEMENTS.get(`receipt:${ref}`);
	if (!raw) return undefined;
	try {
		const value = JSON.parse(raw);
		if (!isJsonObject(value)) return undefined;
		const planId = parsePlanId(value.planId);
		const amountRwf = readNumber(value.amountRwf);
		const status = readString(value.status);
		const createdAt = readString(value.createdAt);
		const expiresAt = readString(value.expiresAt);
		const gpt5DailyMsLimit = readNumber(value.gpt5DailyMsLimit);
		if (!planId || !amountRwf || !status || !createdAt || !expiresAt || gpt5DailyMsLimit === undefined) return undefined;
		if (Date.parse(expiresAt) <= Date.now()) return undefined;
		return { ref, planId, amountRwf, status, createdAt, expiresAt, gpt5DailyMsLimit };
	} catch {
		return undefined;
	}
}

async function getDailyUsage(ref: string, env: Env): Promise<DailyUsageRecord> {
	const date = new Date().toISOString().slice(0, 10);
	const empty = (): DailyUsageRecord => ({ date, gpt5Ms: 0, modelRequests: {}, updatedAt: new Date().toISOString() });
	const raw = await env.ENTITLEMENTS.get(`usage:${ref}:${date}`);
	if (!raw) return empty();
	try {
		const value = JSON.parse(raw);
		if (!isJsonObject(value)) return empty();
		const modelRequestsValue = isJsonObject(value.modelRequests) ? value.modelRequests : {};
		const modelRequests = Object.fromEntries(
			Object.entries(modelRequestsValue).flatMap(([modelId, count]) => {
				const requestCount = readNumber(count);
				return requestCount === undefined ? [] : [[modelId, Math.max(0, Math.floor(requestCount))]];
			}),
		);
		return {
			date,
			gpt5Ms: readNumber(value.gpt5Ms) || 0,
			modelRequests,
			updatedAt: readString(value.updatedAt) || new Date().toISOString(),
		};
	} catch {
		return empty();
	}
}

async function addGpt5Usage(ref: string, elapsedMs: number, env: Env): Promise<void> {
	const usage = await getDailyUsage(ref, env);
	const updated = { ...usage, gpt5Ms: usage.gpt5Ms + Math.max(0, elapsedMs), updatedAt: new Date().toISOString() };
	await env.ENTITLEMENTS.put(`usage:${ref}:${usage.date}`, JSON.stringify(updated), { expirationTtl: 48 * 60 * 60 });
}

async function addModelRequestUsage(ref: string, modelId: string, env: Env): Promise<void> {
	const usage = await getDailyUsage(ref, env);
	const updated = {
		...usage,
		modelRequests: { ...usage.modelRequests, [modelId]: (usage.modelRequests[modelId] || 0) + 1 },
		updatedAt: new Date().toISOString(),
	};
	await env.ENTITLEMENTS.put(`usage:${ref}:${usage.date}`, JSON.stringify(updated), { expirationTtl: 48 * 60 * 60 });
}

async function addAccountModelUsage(userId: string, modelId: string, elapsedMs: number, env: Env): Promise<void> {
	if (!env.DATABASE_URL) return;
	const sql = getSql(env);
	const usedMs = Math.max(0, elapsedMs);
	await sql`
		insert into account_daily_model_usage (user_id, usage_date, model_id, used_ms, request_count)
		values (${userId}, current_date, ${modelId}, ${usedMs}, 1)
		on conflict (user_id, usage_date, model_id) do update set
			used_ms = account_daily_model_usage.used_ms + excluded.used_ms,
			request_count = account_daily_model_usage.request_count + 1,
			updated_at = now()
	`;
}

async function recordModelUsage(
	entitlement: EntitlementRecord,
	model: ManagedModel,
	elapsedMs: number,
	quota: ModelQuotaResult,
	authUser: AuthUser | undefined,
	env: Env,
): Promise<void> {
	try {
		if (quota.trackGpt5) {
			await addGpt5Usage(entitlement.ref, elapsedMs, env);
		}
		if (quota.trackModelRequests) {
			await addModelRequestUsage(entitlement.ref, model.id, env);
		}
		if (authUser) {
			await addAccountModelUsage(authUser.id, model.id, elapsedMs, env);
		}
	} catch (error) {
		console.warn("Failed to record Upskillsafrica model usage", error instanceof Error ? error.message : String(error));
	}
}

function createTransactionRef(planId: PlanId): string {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
	return `USAF-${planId.toUpperCase()}-${Date.now()}-${suffix}`;
}

function isPaidStatus(status: string): boolean {
	return ["processed", "successful", "success", "completed", "paid"].includes(status.toLowerCase());
}

async function safeReadJson(response: Response): Promise<JsonObject> {
	const text = await response.text();
	if (!text) return {};
	try {
		const parsed = JSON.parse(text);
		return isJsonObject(parsed) ? parsed : { value: parsed };
	} catch {
		return { text };
	}
}
