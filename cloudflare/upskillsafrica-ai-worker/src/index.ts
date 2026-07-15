import { neon } from "@neondatabase/serverless";

type JsonObject = Record<string, unknown>;

type ModelSource = "azure_models" | "openrouter";
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
	AZURE_OPENAI_ENDPOINT?: string;
	AZURE_OPENAI_API_KEY?: string;
	ORG_AZURE_OPENAI_ENDPOINT?: string;
	ORG_AZURE_OPENAI_API_KEY?: string;
	ORG_AZURE_AI_PROJECT_ENDPOINT?: string;
	UPSKILLSAFRICA_ORG_CODE?: string;
	AZURE_OPENAI_API_VERSION?: string;
	AZURE_OPENAI_DEPLOYMENT?: string;
	OPENROUTER_API_KEY?: string;
	TEST_PAYMENT_BYPASS_PHONE?: string;
}

type SqlRow = Record<string, unknown>;
type NeonQuery = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<SqlRow[]>;

interface AuthUser {
	id: string;
	email: string;
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
	updatedAt: string;
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
];

const DEFAULT_OPENROUTER_FREE_MODELS: ManagedModel[] = [];

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
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
				return handleModels(env);
			}
			if (url.pathname === "/auth/register" && request.method === "POST") {
				return handleRegister(request, env);
			}
			if (url.pathname === "/auth/login" && request.method === "POST") {
				return handleLogin(request, env);
			}
			if (url.pathname === "/auth/me" && request.method === "GET") {
				return handleMe(request, env);
			}
			if (url.pathname === "/v1/realtime/models" && request.method === "GET") {
				return handleRealtimeModels(request, env);
			}
			if (url.pathname === "/v1/realtime" && request.method === "GET" && request.headers.get("Upgrade")?.toLowerCase() === "websocket") {
				return handleRealtimeWebSocket(request, env);
			}
			if (url.pathname === "/v1/realtime/client-secrets" && request.method === "POST") {
				return handleRealtimeClientSecrets(request, env);
			}
			if (url.pathname === "/subscription/start" && request.method === "POST") {
				return handleSubscriptionStart(request, env);
			}
			if (url.pathname === "/terminal/pay" && request.method === "POST") {
				return handleTerminalPay(request, env);
			}
			if (url.pathname.startsWith("/subscription/verify/") && request.method === "GET") {
				return handleSubscriptionVerify(url.pathname.split("/").pop() || "", env);
			}
			if (url.pathname.startsWith("/credits/") && request.method === "GET") {
				return handleCredits(url.pathname.split("/").pop() || "", env);
			}
			if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
				return handleChatCompletions(request, env);
			}
			return json({ message: "Not Found" }, 404);
		} catch (error) {
			return json({ message: error instanceof Error ? error.message : "Internal error" }, 500);
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
					capabilities: ["chat", "code"],
				},
			];
		});
	} catch {
		return [];
	}
}

function getModels(env: Env): ManagedModel[] {
	const azureModels = parseModelList(env.UPSKILLS_AZURE_MODELS, "azure_models");
	const openRouterModels = parseModelList(env.UPSKILLS_OPENROUTER_MODELS, "openrouter");
	return [
		...(openRouterModels.length > 0 ? openRouterModels : DEFAULT_OPENROUTER_FREE_MODELS),
		...(azureModels.length > 0 ? azureModels.map((model) => ({ ...model, priceTier: "premium" as const })) : DEFAULT_AZURE_MODELS),
	];
}

function handlePlans(env: Env): Response {
	return json({ currency: "RWF", plans: getPlans(env) });
}

function handleModels(env: Env): Response {
	const models = getModels(env);
	return json({
		provider: "Upskillsafrica AI",
		azureProjectEndpoint: env.AZURE_AI_PROJECT_ENDPOINT || DEFAULT_AZURE_PROJECT_ENDPOINT,
		models,
		groups: {
			openrouterFree: models.filter((model) => model.source === "openrouter" && model.priceTier === "free"),
			azurePremium: models.filter((model) => model.source === "azure_models"),
		},
	});
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
	return json({ user, entitlements, models: getModels(env), plans: getPlans(env) });
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
				output_modalities: ["audio", "text"],
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
	const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
	if (!token) return undefined;
	const tokenHash = await sha256Base64(token);
	const sql = getSql(env);
	const rows = await sql`
		select u.id, u.email
		from auth_sessions s
		join users u on u.id = s.user_id
		where s.token_hash = ${tokenHash}
			and s.revoked_at is null
			and s.expires_at > now()
			and u.is_active = true
		limit 1
	`;
	if (rows.length === 0) return undefined;
	await sql`update auth_sessions set last_seen_at = now() where token_hash = ${tokenHash}`;
	return rowToAuthUser(rows[0]);
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
		const receiptRef = readString(row.receipt_ref);
		const planId = parsePlanId(row.plan_id);
		const amountRwf = readNumber(row.amount_rwf);
		const status = readString(row.status);
		const startsAt = readDateString(row.starts_at);
		const expiresAt = readDateString(row.expires_at);
		const gpt5DailyMinutes = readNumber(row.gpt5_daily_minutes);
		if (!receiptRef || !planId || !amountRwf || !status || !startsAt || !expiresAt || gpt5DailyMinutes === undefined) return [];
		return [{ receiptRef, planId, amountRwf, status, startsAt, expiresAt, gpt5DailyMsLimit: gpt5DailyMinutes * 60 * 1000 }];
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
				models: getModels(env),
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
		models: getModels(env),
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



async function handleChatCompletions(request: Request, env: Env): Promise<Response> {
	const receiptHeader = request.headers.get("x-upskillsafrica-receipt");
	const authUser = await getUserFromRequest(request, env);
	const accountEntitlement = authUser ? await getActiveAccountEntitlement(authUser.id, env) : undefined;
	const receiptEntitlement = receiptHeader ? await getValidEntitlement(receiptHeader, env) : undefined;
	const entitlement = accountEntitlement ? accountToEntitlement(accountEntitlement) : receiptEntitlement;
	if (!entitlement) {
		return json({ message: "Upskillsafrica subscription required." }, 402);
	}
	const body = await readJsonObject(request);
	const modelId = resolveUpskillsafricaModelAlias(readString(body.model));
	if (!modelId) {
		return json({ message: "model is required." }, 400);
	}
	let model = getModels(env).find((candidate) => candidate.id === modelId);
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
		return json({ message: "Unknown Upskillsafrica AI model." }, 400);
	}
	if (model.requiresOrgCode && !(await hasValidOrgCode(request, body, env))) {
		return json({ message: "Upskillsafrica organisation code required for this model." }, 403);
	}
	const quota = await assertModelQuota(entitlement, model, env);
	const startedAt = Date.now();
	const response = model.source === "openrouter" ? await routeOpenRouter(body, model, env) : await routeAzure(body, model, env);
	if (response.ok && quota.trackGpt5) {
		await addGpt5Usage(entitlement.ref, Date.now() - startedAt, env);
		if (authUser) {
			await addAccountModelUsage(authUser.id, model.id, Date.now() - startedAt, env);
		}
	}
	return response;
}

async function hasValidOrgCode(request: Request, body: JsonObject, env: Env): Promise<boolean> {
	const provided = request.headers.get("x-upskillsafrica-org-code") || readString(body.organisationCode) || readString(body.organizationCode);
	if (!provided || !env.DATABASE_URL) return false;
	const codeHash = await sha256Base64(provided);
	const sql = getSql(env);
	const rows = await sql`
		select code_hash
		from organisation_codes
		where code_hash = ${codeHash}
			and is_active = true
			and (expires_at is null or expires_at > now())
		limit 1
	`;
	return rows.length > 0;
}

async function assertModelQuota(entitlement: EntitlementRecord, model: ManagedModel, env: Env): Promise<{ trackGpt5: boolean }> {
	if (!isGpt5Model(model)) {
		return { trackGpt5: false };
	}
	const usage = await getDailyUsage(entitlement.ref, env);
	if (usage.gpt5Ms >= entitlement.gpt5DailyMsLimit) {
		throw new Error("Daily gpt-5 limit reached. Use o3, gpt-4o-mini, or OpenRouter free models until reset tomorrow.");
	}
	return { trackGpt5: true };
}

function isGpt5Model(model: ManagedModel): boolean {
	return model.id.includes("gpt-5") || model.deployment === "gpt-5" || model.model === "gpt-5";
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

async function routeAzure(body: JsonObject, model: ManagedModel, env: Env): Promise<Response> {
	const apiKey = model.requiresOrgCode ? env.ORG_AZURE_OPENAI_API_KEY : env.AZURE_OPENAI_API_KEY;
	if (!apiKey) {
		return json({ message: "Azure OpenAI is not configured." }, 503);
	}
	const deployment = model.deployment || model.id.replace(/^azure_models\//, "");
	const apiVersion = env.AZURE_OPENAI_API_VERSION || "2024-10-21";
	const endpoint = (model.requiresOrgCode
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
	const raw = await env.ENTITLEMENTS.get(`usage:${ref}:${date}`);
	if (!raw) return { date, gpt5Ms: 0, updatedAt: new Date().toISOString() };
	try {
		const value = JSON.parse(raw);
		if (!isJsonObject(value)) return { date, gpt5Ms: 0, updatedAt: new Date().toISOString() };
		return {
			date,
			gpt5Ms: readNumber(value.gpt5Ms) || 0,
			updatedAt: readString(value.updatedAt) || new Date().toISOString(),
		};
	} catch {
		return { date, gpt5Ms: 0, updatedAt: new Date().toISOString() };
	}
}

async function addGpt5Usage(ref: string, elapsedMs: number, env: Env): Promise<void> {
	const usage = await getDailyUsage(ref, env);
	const updated = { ...usage, gpt5Ms: usage.gpt5Ms + Math.max(0, elapsedMs), updatedAt: new Date().toISOString() };
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
