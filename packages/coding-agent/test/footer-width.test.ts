import { visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { AgentSession } from "../src/core/agent-session.ts";
import type { ReadonlyFooterDataProvider } from "../src/core/footer-data-provider.ts";
import {
	FooterComponent,
	formatCwdForFooter,
	KINYARWANDA_FOOTER_SAYINGS,
} from "../src/modes/interactive/components/footer.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

type AssistantUsage = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: { total: number };
};

function createSession(options: {
	sessionName: string;
	modelId?: string;
	provider?: string;
	reasoning?: boolean;
	thinkingLevel?: string;
	usage?: AssistantUsage;
}): AgentSession {
	const usage = options.usage;
	const entries =
		usage === undefined
			? []
			: [
					{
						type: "message",
						message: {
							role: "assistant",
							usage,
						},
					},
				];

	const session = {
		state: {
			model: {
				id: options.modelId ?? "test-model",
				provider: options.provider ?? "test",
				contextWindow: 200_000,
				reasoning: options.reasoning ?? false,
			},
			thinkingLevel: options.thinkingLevel ?? "off",
		},
		sessionManager: {
			getEntries: () => entries,
			getSessionName: () => options.sessionName,
			getCwd: () => "/tmp/project",
		},
		getContextUsage: () => ({ contextWindow: 200_000, percent: 12.3 }),
		modelRegistry: {
			isUsingOAuth: () => false,
		},
	};

	return session as unknown as AgentSession;
}

function createFooterData(providerCount: number, weather: string | null = null): ReadonlyFooterDataProvider {
	const provider = {
		getGitBranch: () => "main",
		getExtensionStatuses: () => new Map<string, string>(),
		getAvailableProviderCount: () => providerCount,
		getKigaliWeather: () => weather,
		onBranchChange: (callback: () => void) => {
			void callback;
			return () => {};
		},
	};

	return provider;
}

describe("formatCwdForFooter", () => {
	it("does not abbreviate sibling paths that share the home prefix", () => {
		expect(formatCwdForFooter("/home/user2", "/home/user")).toBe("/home/user2");
	});

	it("abbreviates the home directory and descendants", () => {
		expect(formatCwdForFooter("/home/user", "/home/user")).toBe("~");
		expect(formatCwdForFooter("/home/user/project", "/home/user")).toBe("~/project");
	});
});

describe("FooterComponent width handling", () => {
	beforeAll(() => {
		initTheme(undefined, false);
	});

	it("keeps all lines within width for wide session names", () => {
		const width = 93;
		const session = createSession({ sessionName: "한글".repeat(30) });
		const footer = new FooterComponent(session, createFooterData(1));

		const lines = footer.render(width);
		for (const line of lines) {
			expect(visibleWidth(line)).toBeLessThanOrEqual(width);
		}
	});

	it("keeps stats line within width for wide model and provider names", () => {
		const width = 60;
		const session = createSession({
			sessionName: "",
			modelId: "模".repeat(30),
			provider: "공급자",
			reasoning: true,
			thinkingLevel: "high",
			usage: {
				input: 12_345,
				output: 6_789,
				cacheRead: 0,
				cacheWrite: 0,
				cost: { total: 1.234 },
			},
		});
		const footer = new FooterComponent(session, createFooterData(2));

		const lines = footer.render(width);
		for (const line of lines) {
			expect(visibleWidth(line)).toBeLessThanOrEqual(width);
		}
	});

	it("shows the latest cache hit rate when cache usage is present", () => {
		const session = createSession({
			sessionName: "",
			usage: {
				input: 100,
				output: 10,
				cacheRead: 50,
				cacheWrite: 50,
				cost: { total: 0.001 },
			},
		});
		const footer = new FooterComponent(session, createFooterData(1));

		const statsLine = stripAnsi(footer.render(120)[1]);
		expect(statsLine).toContain("CH25.0%");
	});

	it("renders the Gihanga kumurimo command bar with plain RWF amount and Kigali weather", () => {
		const session = createSession({
			sessionName: "",
			usage: {
				input: 7_800,
				output: 159,
				cacheRead: 0,
				cacheWrite: 0,
				cost: { total: 0.009 },
			},
		});
		const footer = new FooterComponent(session, createFooterData(1, "Kigali 24°C ☀"));

		const lines = footer.render(120).map(stripAnsi);
		const [titleLine, statsLine] = lines;

		expect(titleLine.startsWith("╭─ Gihanga kumurimo · /tmp/project (main)")).toBe(true);
		expect(KINYARWANDA_FOOTER_SAYINGS.some((saying) => titleLine.endsWith(saying))).toBe(true);
		expect(statsLine.startsWith("╰─ test-model")).toBe(true);
		expect(statsLine.endsWith("Kigali 24°C ☀")).toBe(true);
		expect(statsLine).toContain("12.3%/200k");
		expect(statsLine).toContain("↑7.8k ↓159");
		expect(statsLine).toContain("14 RWF");
		expect(statsLine).toContain("Kigali 24°C ☀");
		expect(statsLine).not.toContain("yakoreshejwe");
		expect(statsLine).not.toContain("Codex");
		expect(statsLine).not.toContain("RW Gihanga");
		expect(statsLine).not.toContain("$0.009");
	});

	it("rotates Kinyarwanda footer sayings over time", () => {
		const session = createSession({ sessionName: "" });
		const footer = new FooterComponent(session, createFooterData(1, "Kigali 24°C ☀"));
		const dateSpy = vi.spyOn(Date, "now");
		try {
			const renderedSayings = new Set<string>();
			for (let i = 0; i < 12; i += 1) {
				dateSpy.mockReturnValue(i * 7000);
				const titleLine = stripAnsi(footer.render(120)[0]);
				const saying = KINYARWANDA_FOOTER_SAYINGS.find((candidate) => titleLine.endsWith(candidate));
				if (saying) renderedSayings.add(saying);
			}
			expect(renderedSayings.size).toBeGreaterThan(1);
		} finally {
			dateSpy.mockRestore();
		}
	});
});
