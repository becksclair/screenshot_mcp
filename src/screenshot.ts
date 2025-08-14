import { existsSync, readFileSync, statSync } from "node:fs";
import { getUnsupportedPlatformMessage, supportsScreenshots } from "./platform.js";
// Removed direct shell script spawning; now delegate to TypeScript implementation
import { screenshotApp } from "./winshot.js";

// projectRoot retained only if future relative path needs; currently unused
const _projectRoot = import.meta.dir;

export interface McpTextContent {
	type: "text";
	text: string;
}

export interface McpImageContent {
	type: "image";
	mimeType: string;
	data: string; // base64 data
}

export type McpContentItem = McpTextContent | McpImageContent;

export interface ScreenshotResult {
	[x: string]: unknown;
	content: McpContentItem[];
	isError?: boolean;
}

export interface ListAppsResult {
	[x: string]: unknown;
	content: Array<{
		[x: string]: unknown;
		type: "text";
		text: string;
	}>;
	isError?: boolean;
}

// Helper to decide embedding threshold
const DEFAULT_INLINE_MAX = 1_000_000; // 1MB
function resolveInlineMaxBytes(override?: number): number {
	const envVal = process.env.MCP_SCREENSHOT_EMBED_MAX_BYTES;
	if (override !== undefined) return override;
	if (envVal) {
		const parsed = Number(envVal);
		if (!Number.isNaN(parsed) && parsed > 0) return parsed;
	}
	return DEFAULT_INLINE_MAX;
}

function shouldEmbed(size: number, threshold: number, force?: boolean): boolean {
	if (force) return size <= threshold; // caller opted in with returnData
	return size <= threshold; // auto-embed when small enough
}

export { shouldEmbed };

function embedFileContent(
	path: string,
	label: string, // already includes trailing space and colon phrase used previously
	options: { inlineMaxBytes?: number; force?: boolean }
): ScreenshotResult {
	try {
		const stats = statSync(path);
		const threshold = resolveInlineMaxBytes(options.inlineMaxBytes);
		if (shouldEmbed(stats.size, threshold, options.force)) {
			const buf = readFileSync(path);
			const b64 = buf.toString("base64");
			const kb = Math.round(stats.size / 1024);
			return {
				content: [
					{ type: "image", mimeType: "image/png", data: b64 },
					{ type: "text", text: `${label}${path} (embedded inline, ${kb} KB)` }
				]
			};
		}
		return {
			content: [
				{
					type: "text",
					text: `${label}${path} (not embedded; ${Math.round(stats.size / 1024)} KB exceeds ${Math.round(
						resolveInlineMaxBytes(options.inlineMaxBytes) / 1024
					)} KB limit)`
				}
			]
		};
	} catch (e) {
		return {
			content: [
				{
					type: "text",
					text: `${label}${path} (embedding failed: ${e instanceof Error ? e.message : String(e)})`
				}
			]
		};
	}
}

export async function runScreenshot(
	appName: string,
	options?: {
		compress?: boolean;
		windowStrategy?: "auto" | "id" | "bounds" | "interactive";
		returnData?: boolean; // explicit request for embedding (legacy meaning preserved)
		inlineMaxBytes?: number; // override threshold
	}
): Promise<ScreenshotResult> {
	try {
		// Platform guard - check if screenshots are supported
		if (!supportsScreenshots) {
			return {
				content: [
					{
						type: "text",
						text: `Screenshot failed: ${getUnsupportedPlatformMessage()}`
					}
				],
				isError: true
			};
		}

		// Delegate to TypeScript implementation to avoid shelling out
		const result = await screenshotApp(appName, {
			compress: options?.compress,
			strategy: options?.windowStrategy,
			returnData: options?.returnData
		});

		if (!result.success) {
			return {
				content: [{ type: "text", text: `Screenshot failed: ${result.error || "Unknown error"}` }],
				isError: true
			};
		}

		if (result.path && existsSync(result.path)) {
			return embedFileContent(result.path, "Screenshot successfully taken and saved to: ", {
				inlineMaxBytes: options?.inlineMaxBytes,
				force: options?.returnData
			});
		}
		return {
			content: [
				{ type: "text", text: `Screenshot successfully taken and saved to: ${result.path || "<unknown path>"}` }
			]
		};
	} catch (error) {
		if (error instanceof Error && error.message === "[TIMEOUT]") {
			return {
				content: [
					{
						type: "text",
						text: "Screenshot failed: [TIMEOUT] Operation exceeded 15 second timeout"
					}
				],
				isError: true
			};
		}
		return {
			content: [
				{
					type: "text",
					text: `Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`
				}
			],
			isError: true
		};
	}
}

export async function listRunningApps(): Promise<ListAppsResult> {
	try {
		// Platform guard - check if screenshots are supported (for app detection)
		if (!supportsScreenshots) {
			return {
				content: [
					{
						type: "text",
						text: `App listing failed: ${getUnsupportedPlatformMessage()}`
					}
				],
				isError: true
			};
		}

		// Use AppleScript to get list of running apps with visible windows
		const proc = Bun.spawn(
			[
				"osascript",
				"-e",
				'tell application "System Events" to get name of every process whose background only is false'
			],
			{
				stdout: "pipe",
				stderr: "pipe",
				stdin: "ignore"
			}
		);

		// Create a timeout promise that rejects after 10 seconds
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				proc.kill();
				reject(new Error("[TIMEOUT]"));
			}, 10000); // 10 seconds
		});

		// Race between the process completion and timeout
		const result = await Promise.race([
			Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]).then(
				([stdout, stderr, code]) => ({ stdout, stderr, code })
			),
			timeoutPromise
		]);

		if (result.code !== 0) {
			return {
				content: [
					{
						type: "text",
						text: `App listing failed: ${result.stderr || result.stdout}`
					}
				],
				isError: true
			};
		}

		// Parse the AppleScript output - it returns comma-separated app names
		const appsString = result.stdout.trim();
		if (!appsString) {
			return {
				content: [
					{
						type: "text",
						text: "[]" // Return empty JSON array
					}
				]
			};
		}

		// Split by comma and clean up the app names
		const appNames = appsString
			.split(",")
			.map(name => name.trim())
			.filter(name => name.length > 0)
			.sort((a, b) => a.localeCompare(b));

		// Return as JSON array string
		const appsJson = JSON.stringify(appNames, null, 2);
		return {
			content: [
				{
					type: "text",
					text: appsJson
				}
			]
		};
	} catch (error) {
		if (error instanceof Error && error.message === "[TIMEOUT]") {
			return {
				content: [
					{
						type: "text",
						text: "App listing failed: [TIMEOUT] Operation exceeded 10 second timeout"
					}
				],
				isError: true
			};
		}
		return {
			content: [
				{
					type: "text",
					text: `Error listing running apps: ${error instanceof Error ? error.message : String(error)}`
				}
			],
			isError: true
		};
	}
}

export async function captureRegion(
	x: number,
	y: number,
	width: number,
	height: number,
	options?: { compress?: boolean; returnData?: boolean; inlineMaxBytes?: number }
): Promise<ScreenshotResult> {
	try {
		// Platform guard - check if screenshots are supported
		if (!supportsScreenshots) {
			return {
				content: [
					{
						type: "text",
						text: `Region capture failed: ${getUnsupportedPlatformMessage()}`
					}
				],
				isError: true
			};
		}

		// Validate coordinates are positive
		if (x < 0 || y < 0 || width <= 0 || height <= 0) {
			return {
				content: [
					{
						type: "text",
						text: `Region capture failed: Invalid coordinates. x and y must be non-negative, width and height must be positive. Got: x=${x}, y=${y}, width=${width}, height=${height}`
					}
				],
				isError: true
			};
		}

		// Set up environment variables
		const env = { ...process.env };
		if (options?.compress) {
			env.COMPRESS = "1";
		}

		// Use screencapture directly for region capture
		// Create a timestamp for the filename
		const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
		const screenshotDir = `${process.env.HOME}/Desktop/Screenshots`;
		const filename = `${screenshotDir}/screenshot_region_${x}_${y}_${width}x${height}_${timestamp}.png`;

		// Ensure screenshots directory exists
		const proc = Bun.spawn(["mkdir", "-p", screenshotDir], {
			stdout: "pipe",
			stderr: "pipe",
			stdin: "ignore"
		});
		await proc.exited;

		// Run screencapture with region coordinates
		const captureProc = Bun.spawn(
			[
				"screencapture",
				"-R",
				`${x},${y},${width},${height}`,
				"-o", // Capture without cursor
				filename
			],
			{
				stdout: "pipe",
				stderr: "pipe",
				stdin: "ignore",
				env
			}
		);

		// Create a timeout promise that rejects after 10 seconds
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				captureProc.kill();
				reject(new Error("[TIMEOUT]"));
			}, 10000); // 10 seconds
		});

		// Race between the process completion and timeout
		const result = await Promise.race([
			Promise.all([
				new Response(captureProc.stdout).text(),
				new Response(captureProc.stderr).text(),
				captureProc.exited
			]).then(([stdout, stderr, code]) => ({ stdout, stderr, code })),
			timeoutPromise
		]);

		if (result.code !== 0) {
			return {
				content: [
					{
						type: "text",
						text: `Region capture failed: ${result.stderr || result.stdout || "Unknown error"}`
					}
				],
				isError: true
			};
		}

		// Verify the file actually exists
		if (!existsSync(filename)) {
			return {
				content: [
					{
						type: "text",
						text: `Region capture appears to have been taken but file not found at expected location: ${filename}. The capture may have failed silently.`
					}
				],
				isError: false
			};
		}

		// Optional compression
		if (options?.compress) {
			const compressProc = Bun.spawn(
				["sips", "-s", "format", "png", "--setProperty", "formatOptions", "default", filename],
				{
					stdout: "pipe",
					stderr: "pipe",
					stdin: "ignore"
				}
			);

			await compressProc.exited;
		}

		return embedFileContent(filename, "Region screenshot successfully captured and saved to: ", {
			inlineMaxBytes: options?.inlineMaxBytes,
			force: options?.returnData
		});
	} catch (error) {
		if (error instanceof Error && error.message === "[TIMEOUT]") {
			return {
				content: [
					{
						type: "text",
						text: "Region capture failed: [TIMEOUT] Operation exceeded 10 second timeout"
					}
				],
				isError: true
			};
		}
		return {
			content: [
				{
					type: "text",
					text: `Error capturing region: ${error instanceof Error ? error.message : String(error)}`
				}
			],
			isError: true
		};
	}
}
