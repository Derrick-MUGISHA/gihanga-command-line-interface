import { type ChildProcessByStdio, spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { WebSocket } from "undici";
import type { AuthStorage } from "../core/auth-storage.ts";

const UPSKILLSAFRICA_PROVIDER_ID = "upskillsafrica";
const DEFAULT_BACKEND_URL = "https://upskillsafrica-ai-backend.boyg87059.workers.dev";
const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
const SAMPLE_RATE = 24_000;
const KINYARWANDA_COMMAND_VOCABULARY = `Kinyarwanda command hints: "soma dosiye" means read a file; "andika muri dosiye" means write to a file; "hindura dosiye" means edit a file; "kora test" means run tests; "kora build" means build the project; "reba dosiye" means inspect files; "shakisha" means search; "siba" means delete; "fungura" means open; "ohereza" means deploy or send. Convert Kinyarwanda commands into clear English commands. Preserve file names, paths, commands, and technical terms exactly.`;

function getBackendUrl(authStorage: AuthStorage): string {
	const credential = authStorage.get(UPSKILLSAFRICA_PROVIDER_ID);
	if (credential?.type === "api_key" && credential.env?.UPSKILLSAFRICA_BACKEND_URL) {
		return credential.env.UPSKILLSAFRICA_BACKEND_URL.replace(/\/$/, "");
	}
	return DEFAULT_BACKEND_URL;
}

function getToken(authStorage: AuthStorage): string | undefined {
	const credential = authStorage.get(UPSKILLSAFRICA_PROVIDER_ID);
	return credential?.type === "api_key" ? credential.key : undefined;
}

function startMicrophone(): ChildProcessByStdio<null, Readable, Readable> {
	const platformArgs =
		process.platform === "darwin"
			? ["-f", "avfoundation", "-i", ":0"]
			: process.platform === "win32"
				? ["-f", "dshow", "-i", "audio=default"]
				: ["-f", "pulse", "-i", process.env.GIHANGA_VOICE_SOURCE || "default"];
	return spawn(
		"ffmpeg",
		[
			"-hide_banner",
			"-loglevel",
			"error",
			"-fflags",
			"nobuffer",
			"-flags",
			"low_delay",
			"-probesize",
			"32",
			"-analyzeduration",
			"0",
			...platformArgs,
			"-ac",
			"1",
			"-ar",
			String(SAMPLE_RATE),
			"-f",
			"s16le",
			"pipe:1",
		],
		{
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
}

function startSpeaker(): ChildProcessByStdio<Writable, null, null> {
	const environment = { ...process.env };
	if (process.platform === "linux") {
		environment.SDL_AUDIODRIVER = "pulse";
		environment.PULSE_SINK = process.env.GIHANGA_VOICE_SINK || "default";
	}
	return spawn(
		"ffplay",
		[
			"-hide_banner",
			"-loglevel",
			"quiet",
			"-fflags",
			"nobuffer",
			"-flags",
			"low_delay",
			"-framedrop",
			"-sync",
			"audio",
			"-nodisp",
			"-autoexit",
			"-f",
			"s16le",
			"-ar",
			String(SAMPLE_RATE),
			"-ac",
			"1",
			"-i",
			"pipe:0",
		],
		{
			stdio: ["pipe", "ignore", "ignore"],
			env: environment,
		},
	);
}

function toText(data: unknown): Promise<string> | string {
	if (typeof data === "string") return data;
	if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
	if (data instanceof Blob) return data.text();
	return String(data);
}

export interface VoiceModeOptions {
	onTranscript?: (transcript: string) => Promise<void>;
}

async function playGreeting(backendUrl: string, token: string, model: string): Promise<void> {
	const greeting = "Hello, I am happy to help.";
	const socket = new WebSocket(`${backendUrl.replace(/^http/, "ws")}/v1/realtime?model=${encodeURIComponent(model)}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	const speaker = startSpeaker();
	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			socket.close();
			reject(new Error("Greeting timeout"));
		}, 12_000);
		const finish = (error?: Error): void => {
			clearTimeout(timeout);
			speaker.stdin.end();
			if (speaker.exitCode === null) speaker.kill("SIGTERM");
			error ? reject(error) : resolve();
		};
		socket.addEventListener("open", () => {
			socket.send(
				JSON.stringify({
					type: "session.update",
					session: {
						type: "realtime",
						model,
						output_modalities: ["audio"],
						instructions: `Speak only this warm, charming Kinyarwanda greeting: ${greeting}`,
						audio: { output: { format: { type: "audio/pcm", rate: SAMPLE_RATE }, voice: "shimmer" } },
					},
				}),
			);
			socket.send(JSON.stringify({ type: "response.create" }));
		});
		socket.addEventListener("message", async (event) => {
			try {
				const message = JSON.parse(await toText(event.data as unknown)) as {
					type?: string;
					delta?: string;
					error?: { message?: string };
				};
				if (
					(message.type === "response.output_audio.delta" || message.type === "response.audio.delta") &&
					message.delta
				) {
					speaker.stdin.write(Buffer.from(message.delta, "base64"));
				} else if (message.type === "response.done") {
					socket.close();
					finish();
				} else if (message.type === "error") {
					finish(new Error(message.error?.message || "Greeting failed"));
				}
			} catch (error) {
				finish(error instanceof Error ? error : new Error("Invalid greeting event"));
			}
		});
		socket.addEventListener("error", () => finish(new Error("Greeting connection failed")));
		socket.addEventListener("close", () => finish());
		speaker.on("error", () => finish(new Error("Audio playback unavailable")));
	});
}

export async function speakText(authStorage: AuthStorage, text: string): Promise<void> {
	const token = getToken(authStorage);
	if (!token || !text.trim()) return;
	const backendUrl = getBackendUrl(authStorage);
	const modelsResponse = await fetch(`${backendUrl}/v1/realtime/models`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!modelsResponse.ok) return;
	const modelsBody = (await modelsResponse.json().catch(() => ({}))) as { models?: unknown[] };
	const model = typeof modelsBody.models?.[0] === "string" ? modelsBody.models[0] : DEFAULT_REALTIME_MODEL;
	const socket = new WebSocket(`${backendUrl.replace(/^http/, "ws")}/v1/realtime?model=${encodeURIComponent(model)}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	const speaker = startSpeaker();
	await new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			socket.close();
			speaker.stdin.end();
			resolve();
		}, 30_000);
		const finish = (): void => {
			clearTimeout(timeout);
			speaker.stdin.end();
			if (speaker.exitCode === null) speaker.kill("SIGTERM");
			resolve();
		};
		socket.addEventListener("open", () => {
			socket.send(
				JSON.stringify({
					type: "session.update",
					session: {
						type: "realtime",
						model,
						output_modalities: ["audio"],
						instructions:
							"Speak the assistant response in English only. Translate any Kinyarwanda content to English. Do not add commentary.",
						audio: { output: { format: { type: "audio/pcm", rate: SAMPLE_RATE }, voice: "shimmer" } },
					},
				}),
			);
			socket.send(
				JSON.stringify({
					type: "conversation.item.create",
					item: { type: "message", role: "user", content: [{ type: "input_text", text }] },
				}),
			);
			socket.send(JSON.stringify({ type: "response.create" }));
		});
		socket.addEventListener("message", async (event) => {
			try {
				const message = JSON.parse(await toText(event.data as unknown)) as { type?: string; delta?: string };
				if (
					(message.type === "response.output_audio.delta" || message.type === "response.audio.delta") &&
					message.delta
				) {
					speaker.stdin.write(Buffer.from(message.delta, "base64"));
				} else if (message.type === "response.done") {
					socket.close();
					finish();
				}
			} catch {
				finish();
			}
		});
		socket.addEventListener("error", finish);
		socket.addEventListener("close", finish);
		speaker.on("error", finish);
	});
}

function isUsableVoiceCommand(value: string): boolean {
	const normalized = value.trim().toUpperCase().replace(/[.!?]/g, "").replace(/\s+/g, " ");
	return (
		normalized.length >= 3 &&
		normalized !== "NO COMMAND" &&
		normalized !== "NO_COMMAND" &&
		!normalized.startsWith("NO COMMAND ")
	);
}

export async function runVoiceMode(authStorage: AuthStorage, options: VoiceModeOptions = {}): Promise<void> {
	const commandMode = options.onTranscript !== undefined;
	const token = getToken(authStorage);
	if (!token) {
		throw new Error("Injira muri Upskillsafrica ubanza ukoreshe /kwinjira.");
	}

	const backendUrl = getBackendUrl(authStorage);
	const modelsResponse = await fetch(`${backendUrl}/v1/realtime/models`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	const modelsBody = (await modelsResponse.json().catch(() => ({}))) as { models?: unknown[]; message?: string };
	if (!modelsResponse.ok) {
		throw new Error(modelsBody.message || "Realtime voice is only available to paid Upskillsafrica users.");
	}
	const model = typeof modelsBody.models?.[0] === "string" ? modelsBody.models[0] : DEFAULT_REALTIME_MODEL;
	if (commandMode) {
		try {
			await playGreeting(backendUrl, token, model);
		} catch {
			// Greeting failure must not prevent background voice commands from starting.
		}
	}
	const wsUrl = `${backendUrl.replace(/^http/, "ws")}/v1/realtime?model=${encodeURIComponent(model)}`;
	const socket = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${token}` } });
	const microphone = startMicrophone();
	const speaker = commandMode ? undefined : startSpeaker();
	let closed = false;
	let commandBuffer = "";

	const stop = (): void => {
		if (closed) return;
		closed = true;
		microphone.stdout.removeAllListeners();
		microphone.kill("SIGTERM");
		if (speaker) {
			speaker.stdin.end();
			if (speaker.exitCode === null) speaker.kill("SIGTERM");
		}
		if (socket.readyState === WebSocket.OPEN) socket.close();
	};

	process.once("SIGINT", stop);
	process.once("SIGTERM", stop);

	await new Promise<void>((resolve, reject) => {
		let settled = false;
		const finish = (error?: Error): void => {
			if (settled) return;
			settled = true;
			stop();
			error ? reject(error) : resolve();
		};
		socket.addEventListener("open", () => {
			socket.send(
				JSON.stringify({
					type: "session.update",
					session: {
						type: "realtime",
						model,
						output_modalities: commandMode ? ["text"] : ["audio"],
						instructions: commandMode
							? `Listen to Kinyarwanda or English, but return an English command only. ${KINYARWANDA_COMMAND_VOCABULARY} If there is no clear user speech or no command, return exactly NO_COMMAND and nothing else. Do not answer the command or add commentary.`
							: "Respond in English only.",
						audio: {
							input: {
								format: { type: "audio/pcm", rate: SAMPLE_RATE },
								turn_detection: {
									type: "server_vad",
									threshold: 0.2,
									prefix_padding_ms: 300,
									silence_duration_ms: 500,
									create_response: !commandMode,
								},
							},
							...(commandMode
								? {}
								: { output: { format: { type: "audio/pcm", rate: SAMPLE_RATE }, voice: "alloy" } }),
						},
					},
				}),
			);
			microphone.stdout.on("data", (chunk: Buffer) => {
				if (socket.readyState === WebSocket.OPEN) {
					socket.send(JSON.stringify({ type: "input_audio_buffer.append", audio: chunk.toString("base64") }));
				}
			});
		});
		socket.addEventListener("message", async (event) => {
			try {
				const message = JSON.parse(await toText(event.data as unknown)) as {
					type?: string;
					delta?: string;
					text?: string;
					error?: { message?: string };
				};
				if (
					(message.type === "response.output_audio.delta" || message.type === "response.audio.delta") &&
					speaker
				) {
					if (message.delta) speaker.stdin.write(Buffer.from(message.delta, "base64"));
				} else if (message.type === "input_audio_buffer.speech_stopped" && commandMode) {
					socket.send(JSON.stringify({ type: "response.create" }));
				} else if (message.type === "response.output_text.delta") {
					if (message.delta) {
						commandBuffer += message.delta;
						if (!commandMode) process.stdout.write(message.delta);
					}
				} else if (message.type === "response.output_text.done") {
					const command = (message.text || commandBuffer).trim();
					commandBuffer = "";
					if (commandMode && isUsableVoiceCommand(command) && options.onTranscript) {
						await options.onTranscript(command);
					}
				} else if (message.type === "response.audio_transcript.delta") {
					if (message.delta) process.stdout.write(message.delta);
				} else if (message.type === "error") {
					finish(new Error(message.error?.message || "Realtime voice error."));
				} else if (message.type === "session.created") {
					// Background voice session is intentionally silent in the TUI.
				}
			} catch (error) {
				finish(error instanceof Error ? error : new Error("Invalid realtime event."));
			}
		});
		socket.addEventListener("error", () => finish(new Error("Realtime voice connection failed.")));
		socket.addEventListener("close", () => finish());
		microphone.on("error", () => finish(new Error("Microphone requires ffmpeg. Install ffmpeg and try again.")));
		if (speaker)
			speaker.on("error", () => finish(new Error("Audio playback requires ffplay. Install ffmpeg and try again.")));
	});
}
