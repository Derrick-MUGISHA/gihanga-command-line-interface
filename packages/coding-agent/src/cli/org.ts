import { join } from "node:path";
import chalk from "chalk";
import { type AuthCredential, AuthStorage } from "../core/auth-storage.ts";

const UPSKILLS_AFRICA_ACCOUNT_PROVIDER_ID = "upskillsafrica-rask-d-technology";
const UPSKILLS_AFRICA_MODEL_PROVIDER_ID = "upskillsafrica";
const UPSKILLS_AFRICA_BACKEND_URL = "https://upskillsafrica-ai-backend.boyg87059.workers.dev";

function maskCode(code: string): string {
	if (code.length <= 8) return "••••";
	return `${code.slice(0, 4)}…${code.slice(-4)}`;
}

function getApiKeyCredential(
	credential: AuthCredential | undefined,
): Extract<AuthCredential, { type: "api_key" }> | undefined {
	return credential?.type === "api_key" ? credential : undefined;
}

function getExistingToken(authStorage: AuthStorage): string | undefined {
	const modelCredential = getApiKeyCredential(authStorage.get(UPSKILLS_AFRICA_MODEL_PROVIDER_ID));
	const accountCredential = getApiKeyCredential(authStorage.get(UPSKILLS_AFRICA_ACCOUNT_PROVIDER_ID));
	return modelCredential?.key ?? accountCredential?.key;
}

function getMergedEnv(authStorage: AuthStorage): Record<string, string> {
	const modelCredential = getApiKeyCredential(authStorage.get(UPSKILLS_AFRICA_MODEL_PROVIDER_ID));
	const accountCredential = getApiKeyCredential(authStorage.get(UPSKILLS_AFRICA_ACCOUNT_PROVIDER_ID));
	return {
		...(accountCredential?.env ?? {}),
		...(modelCredential?.env ?? {}),
	};
}

function saveUpskillsafricaCredential(authStorage: AuthStorage, token: string, env: Record<string, string>): void {
	for (const providerId of [UPSKILLS_AFRICA_ACCOUNT_PROVIDER_ID, UPSKILLS_AFRICA_MODEL_PROVIDER_ID]) {
		authStorage.set(providerId, { type: "api_key", key: token, env });
	}
}

function printOrgHelp(): void {
	console.log(`Usage:
  gihanga org status
  gihanga org add <organisation-code>
  gihanga org remove

Login first from the TUI if needed:
  gihanga
  /kwinjira`);
}

export async function handleOrgCommand(args: string[], options: { agentDir: string }): Promise<boolean> {
	const command = args[0];
	if (command !== "org" && command !== "organization" && command !== "organisation") return false;

	const action = args[1] ?? "status";
	const authStorage = AuthStorage.create(join(options.agentDir, "auth.json"));
	const token = getExistingToken(authStorage);
	const env = getMergedEnv(authStorage);
	const currentCode = env.UPSKILLSAFRICA_ORG_CODE;

	if (action === "status") {
		console.log(chalk.bold("Upskillsafrica organisation access"));
		console.log(`Login: ${token ? chalk.green("configured") : chalk.yellow("not configured")}`);
		console.log(`Organisation code: ${currentCode ? chalk.green(maskCode(currentCode)) : chalk.yellow("not set")}`);
		if (!token) console.log(chalk.dim("Run `gihanga`, type `/kwinjira`, and login/register first."));
		return true;
	}

	if (action === "add" || action === "set") {
		const organisationCode = args[2]?.trim();
		if (!organisationCode) {
			console.error(chalk.red("Error: organisation code is required."));
			printOrgHelp();
			process.exitCode = 1;
			return true;
		}
		if (!token) {
			console.error(chalk.red("Error: login first before saving an organisation code."));
			console.error(chalk.dim("Run `gihanga`, type `/kwinjira`, and login/register with Upskillsafrica."));
			process.exitCode = 1;
			return true;
		}
		saveUpskillsafricaCredential(authStorage, token, {
			...env,
			UPSKILLSAFRICA_BACKEND_URL: UPSKILLS_AFRICA_BACKEND_URL,
			UPSKILLSAFRICA_ORG_CODE: organisationCode,
		});
		console.log(chalk.green("Organisation code saved."));
		console.log(chalk.dim("Choose an Upskillsafrica organisation model in Gihanga to use it."));
		return true;
	}

	if (action === "remove" || action === "rm" || action === "clear") {
		if (!token) {
			console.log(chalk.yellow("No Upskillsafrica login found."));
			return true;
		}
		const nextEnv: Record<string, string> = { ...env, UPSKILLSAFRICA_BACKEND_URL: UPSKILLS_AFRICA_BACKEND_URL };
		delete nextEnv.UPSKILLSAFRICA_ORG_CODE;
		saveUpskillsafricaCredential(authStorage, token, nextEnv);
		console.log(chalk.green("Organisation code removed from local Gihanga credentials."));
		return true;
	}

	printOrgHelp();
	process.exitCode = 1;
	return true;
}
