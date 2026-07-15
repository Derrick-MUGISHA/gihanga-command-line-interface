import { type ChildProcessByStdio, spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { WebSocket } from "undici";
import type { AuthStorage } from "../core/auth-storage.ts";

const UPSKILLSAFRICA_PROVIDER_ID = "upskillsafrica";
const DEFAULT_BACKEND_URL = "https://upskillsafrica-ai-backend.boyg87059.workers.dev";
const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
const SAMPLE_RATE = 24_000;

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
	const wsUrl = `${backendUrl.replace(/^http/, "ws")}/v1/realtime?model=${encodeURIComponent(model)}`;
	const socket = new WebSocket(wsUrl, { headers: { Authorization: `Bearer ${token}` } });
	const microphone = startMicrophone();
	const speaker = commandMode ? undefined : startSpeaker();
	let closed = false;
	let animationTimer: NodeJS.Timeout | undefined;
	let animationFrame = 0;
	let commandBuffer = "";

	const startAnimation = (): void => {
		if (animationTimer) return;
		animationTimer = setInterval(() => {
			const frames = ["▁▂▃▄▅▆▇", "▂▃▄▅▆▇▆", "▃▄▅▆▇▆▅", "▄▅▆▇▆▅▄", "▅▆▇▆▅▄▃", "▆▇▆▅▄▃▂"];
			process.stdout.write(`\r◉ Vuga  ${frames[animationFrame % frames.length]}  speaking/listening`);
			animationFrame++;
		}, 120);
	};

	const stopAnimation = (): void => {
		if (!animationTimer) return;
		clearInterval(animationTimer);
		animationTimer = undefined;
		process.stdout.write("\r◉ Vuga  ░░░░░░░  stopped                    \n");
	};

	const stop = (): void => {
		if (closed) return;
		closed = true;
		stopAnimation();
		microphone.stdout.removeAllListeners();
		microphone.kill("SIGTERM");
		if (speaker) {
			speaker.stdin.end();
			if (speaker.exitCode === null) speaker.kill("SIGTERM");
		}
		if (socket.readyState === WebSocket.OPEN) socket.close();
		process.stdout.write("\n◉ Vuga irangiye.\n");
	};

	process.stdout.write(`◉ Gihanga Vuga · ${model}\nVuga ubu. Kanda Ctrl+C uhagarike.\n`);
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
							? "Listen to the user's Kinyarwanda or English command. Return only the command text, without answering it, translating it, or adding commentary."
							: "Respond in Kinyarwanda by default unless the user asks for English.",
						audio: {
							input: {
								format: { type: "audio/pcm", rate: SAMPLE_RATE },
								turn_detection: { type: "server_vad", create_response: !commandMode },
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
					if (commandMode && command && options.onTranscript) {
						process.stdout.write(`\n◉ command: ${command}\n`);
						await options.onTranscript(command);
					}
				} else if (message.type === "response.audio_transcript.delta") {
					if (message.delta) process.stdout.write(message.delta);
				} else if (message.type === "error") {
					finish(new Error(message.error?.message || "Realtime voice error."));
				} else if (message.type === "session.created") {
					process.stdout.write("\n◉ realtime connected\n");
					startAnimation();
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
