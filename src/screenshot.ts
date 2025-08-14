import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { getUnsupportedPlatformMessage, supportsScreenshots } from "./platform.js";

const projectRoot = import.meta.dir;

export interface ScreenshotResult {
	[x: string]: unknown;
	content: Array<{
		[x: string]: unknown;
		type: "text";
		text: string;
	}>;
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

export async function runScreenshot(
	appName: string,
	options?: { compress?: boolean; windowStrategy?: "auto" | "id" | "bounds" | "interactive"; returnData?: boolean }
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

		const scriptPath = join(projectRoot, "..", "winshot.sh");

		// Set up environment variables
		const env = { ...process.env };
		if (options?.compress) {
			env.COMPRESS = "1";
		}
		if (options?.windowStrategy) {
			env.WINDOW_STRATEGY = options.windowStrategy;
		}

		const proc = Bun.spawn(["bash", scriptPath, appName], {
			stdout: "pipe",
			stderr: "pipe",
			stdin: "ignore",
			env
		});

		// Create a timeout promise that rejects after 15 seconds
		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => {
				proc.kill(); // Kill the process
				reject(new Error("[TIMEOUT]"));
			}, 15000); // 15 seconds
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
						text: `Screenshot failed: ${result.stderr || result.stdout}`
					}
				],
				isError: true
			};
		}

		// Extract the screenshot path from the output
		const screenshotMatch = result.stdout.match(/Screenshot saved: (.+\.png)/);
		const screenshotPath = screenshotMatch ? screenshotMatch[1] : null;

		if (!screenshotPath) {
			return {
				content: [
					{
						type: "text",
						text: `Screenshot taken but could not determine file path. Output: ${result.stdout}`
					}
				]
			};
		}

		// Verify the file actually exists
		if (!existsSync(screenshotPath)) {
			return {
				content: [
					{
						type: "text",
						text: `Screenshot appears to have been taken but file not found at expected location: ${screenshotPath}. The capture may have failed silently.`
					}
				],
				isError: false // This is a warning, not a hard error
			};
		}

		// Handle returnData option for base64 encoding
		if (options?.returnData) {
			try {
				// Check file size (1MB = 1024 * 1024 bytes)
				const stats = statSync(screenshotPath);
				const fileSizeInBytes = stats.size;
				const maxSizeInBytes = 1024 * 1024; // 1MB

				if (fileSizeInBytes > maxSizeInBytes) {
					return {
						content: [
							{
								type: "text",
								text: `Screenshot file too large for base64 encoding (${Math.round(fileSizeInBytes / 1024)} KB > 1024 KB limit). Use returnData=false to get file path instead. File saved to: ${screenshotPath}`
							}
						],
						isError: false
					};
				}

				// Read the file and encode as base64
				const fileBuffer = readFileSync(screenshotPath);
				const base64Data = fileBuffer.toString('base64');
				const dataUri = `data:image/png;base64,${base64Data}`;

				return {
					content: [
						{
							type: "text",
							text: `Screenshot successfully captured as base64 data (${Math.round(fileSizeInBytes / 1024)} KB): ${dataUri}`
						}
					]
				};
			} catch (readError) {
				return {
					content: [
						{
							type: "text",
							text: `Screenshot taken and saved to: ${screenshotPath}, but failed to read file for base64 encoding: ${readError instanceof Error ? readError.message : String(readError)}`
						}
					],
					isError: false // File was created successfully, just couldn't encode
				};
			}
		}

		return {
			content: [
				{
					type: "text",
					text: `Screenshot successfully taken and saved to: ${screenshotPath}`
				}
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
	options?: { compress?: boolean; returnData?: boolean }
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

		// Handle returnData option for base64 encoding
		if (options?.returnData) {
			try {
				// Check file size (1MB = 1024 * 1024 bytes)
				const stats = statSync(filename);
				const fileSizeInBytes = stats.size;
				const maxSizeInBytes = 1024 * 1024; // 1MB

				if (fileSizeInBytes > maxSizeInBytes) {
					return {
						content: [
							{
								type: "text",
								text: `Region screenshot file too large for base64 encoding (${Math.round(fileSizeInBytes / 1024)} KB > 1024 KB limit). Use returnData=false to get file path instead. File saved to: ${filename}`
							}
						],
						isError: false
					};
				}

				// Read the file and encode as base64
				const fileBuffer = readFileSync(filename);
				const base64Data = fileBuffer.toString('base64');
				const dataUri = `data:image/png;base64,${base64Data}`;

				return {
					content: [
						{
							type: "text",
							text: `Region screenshot successfully captured as base64 data (${Math.round(fileSizeInBytes / 1024)} KB): ${dataUri}`
						}
					]
				};
			} catch (readError) {
				return {
					content: [
						{
							type: "text",
							text: `Region screenshot taken and saved to: ${filename}, but failed to read file for base64 encoding: ${readError instanceof Error ? readError.message : String(readError)}`
						}
					],
					isError: false // File was created successfully, just couldn't encode
				};
			}
		}

		return {
			content: [
				{
					type: "text",
					text: `Region screenshot successfully captured and saved to: ${filename}`
				}
			]
		};
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
