#!/usr/bin/env node
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";

const DEFAULT_DATASET = "mbazaNLP/kinyarwanda_monolingual_v01.0";

function usage() {
	console.log(`Gihanga Mbaza NLP importer

Downloads Mbaza NLP Kinyarwanda dataset files into a local Gihanga data folder.
Raw dataset text is not bundled with Gihanga; users download it locally and keep attribution/licensing intact.

Usage:
  node import-mbaza-nlp.mjs [options]

Options:
  --dataset <id>     Hugging Face dataset id (default: ${DEFAULT_DATASET})
  --out <dir>        Output directory (default: ~/.gihanga/agent/data/mbaza-nlp)
  --metadata-only    Write dataset metadata only; do not download parquet files
  --help             Show this help

Environment:
  HF_TOKEN           Optional Hugging Face token. Required for gated datasets after accepting terms.

Examples:
  node ~/.gihanga/agent/scripts/import-mbaza-nlp.mjs --metadata-only
  node ~/.gihanga/agent/scripts/import-mbaza-nlp.mjs
  node ~/.gihanga/agent/scripts/import-mbaza-nlp.mjs --dataset mbazaNLP/kinyarwanda_monolingual_v01.1
`);
}

function parseArgs(argv) {
	const options = {
		dataset: DEFAULT_DATASET,
		out: join(process.env.HOME || process.cwd(), ".gihanga", "agent", "data", "mbaza-nlp"),
		metadataOnly: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--help" || arg === "-h") {
			usage();
			process.exit(0);
		}
		if (arg === "--metadata-only") {
			options.metadataOnly = true;
			continue;
		}
		if (arg === "--dataset") {
			const value = argv[++i];
			if (!value) throw new Error("--dataset requires a value");
			options.dataset = value;
			continue;
		}
		if (arg === "--out") {
			const value = argv[++i];
			if (!value) throw new Error("--out requires a value");
			options.out = value;
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}
	options.out = resolve(options.out.replace(/^~(?=$|\/)/, process.env.HOME || "~"));
	return options;
}

function hfHeaders() {
	const headers = { "user-agent": "gihanga-mbaza-nlp-importer" };
	if (process.env.HF_TOKEN) {
		headers.authorization = `Bearer ${process.env.HF_TOKEN}`;
	}
	return headers;
}

async function fetchJson(url) {
	const response = await fetch(url, { headers: hfHeaders() });
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: HTTP ${response.status} ${response.statusText}`);
	}
	return response.json();
}

async function downloadFile(url, outputPath) {
	if (existsSync(outputPath)) {
		console.log(`Exists: ${outputPath}`);
		return;
	}
	mkdirSync(dirname(outputPath), { recursive: true });
	const response = await fetch(url, { headers: hfHeaders() });
	if (!response.ok || !response.body) {
		if (response.status === 401 || response.status === 403) {
			throw new Error(
				`Dataset file is gated or private. Accept the dataset terms on Hugging Face and rerun with HF_TOKEN set. URL: ${url}`,
			);
		}
		throw new Error(`Failed to download ${url}: HTTP ${response.status} ${response.statusText}`);
	}
	console.log(`Downloading: ${url}`);
	await pipeline(response.body, createWriteStream(outputPath));
	console.log(`Saved: ${outputPath}`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	mkdirSync(options.out, { recursive: true });

	const apiUrl = `https://huggingface.co/api/datasets/${options.dataset}`;
	const metadata = await fetchJson(apiUrl);
	const parquetFiles = (metadata.siblings || [])
		.map((sibling) => sibling.rfilename)
		.filter((name) => name && name.endsWith(".parquet"));

	const profile = {
		name: "mbaza-nlp-local-import",
		dataset: options.dataset,
		url: `https://huggingface.co/datasets/${options.dataset}`,
		sha: metadata.sha,
		license: metadata.cardData?.license || metadata.cardData?.license_name || "see dataset card",
		language: metadata.cardData?.language || metadata.tags?.filter((tag) => tag.startsWith("language:")),
		tags: metadata.tags || [],
		files: parquetFiles,
		note:
			"Gihanga stores dataset metadata and optionally downloads raw parquet files locally. Do not republish large raw text chunks; cite Mbaza NLP and follow dataset terms.",
	};
	const profilePath = join(options.out, "mbaza-nlp-profile.json");
	writeFileSync(profilePath, JSON.stringify(profile, null, 2));
	console.log(`Wrote: ${profilePath}`);

	if (options.metadataOnly) {
		console.log("Metadata-only mode; no parquet files downloaded.");
		return;
	}

	if (parquetFiles.length === 0) {
		console.log("No parquet files found in dataset metadata. Nothing to download.");
		return;
	}

	for (const file of parquetFiles) {
		const url = `https://huggingface.co/datasets/${options.dataset}/resolve/main/${file}`;
		await downloadFile(url, join(options.out, file));
	}

	console.log("Mbaza NLP import complete.");
}

main().catch((error) => {
	console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
