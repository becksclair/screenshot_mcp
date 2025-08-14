import { join } from "node:path";
import { existsSync } from "node:fs";
import { supportsScreenshots, getUnsupportedPlatformMessage } from "./platform.js";

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

export async function runScreenshot(appName: string, options?: { compress?: boolean }): Promise<ScreenshotResult> {
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
