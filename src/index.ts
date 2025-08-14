#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getPlatformInfo } from "./platform.js";
import { captureRegion, listRunningApps, runScreenshot } from "./screenshot.js";

// Create an MCP server using the modern API
const server = new McpServer({
	name: "screenshot-mcp",
	version: "1.0.0"
});

// Register the screenshot tool using the modern registerTool API
server.registerTool(
	"take_screenshot",
	{
		title: "Take Screenshot",
		description: "Take a screenshot of the specified app and return the screenshot file path",
		inputSchema: {
			appName: z
				.string()
				.max(100)
				.describe("The name of the app to screenshot (e.g., 'Visual Studio Code', 'Safari')"),
			compress: z
				.boolean()
				.optional()
				.describe("Whether to compress the PNG file to reduce size (default: false)"),
			format: z
				.enum(["png"])
				.optional()
				.default("png")
				.describe("Screenshot format (currently only 'png' is supported)"),
			windowStrategy: z
				.enum(["auto", "id", "bounds", "interactive"])
				.optional()
				.default("auto")
				.describe(
					"Window capture strategy: 'auto' (smart detection), 'id' (window ID), 'bounds' (window bounds), 'interactive' (user selection)"
				),
			returnData: z
				.boolean()
				.optional()
				.describe("If true, return base64 encoded image data instead of file path (size limit: 1MB, default: false)")
		}
	},
	async ({ appName, compress, format, windowStrategy, returnData }) => {
		// Validate format (should already be validated by Zod, but double-check)
		if (format && format !== "png") {
			return {
				content: [
					{
						type: "text",
						text: `Screenshot failed: Format '${format}' is not supported. Only 'png' format is currently available.`
					}
				],
				isError: true
			};
		}

		return await runScreenshot(appName, { compress, windowStrategy, returnData });
	}
);

// Register the list_running_apps tool
server.registerTool(
	"list_running_apps",
	{
		title: "List Running Apps",
		description: "Get a JSON array of currently running applications with visible windows",
		inputSchema: {}
	},
	async () => {
		return await listRunningApps();
	}
);

// Register the capture_region tool
server.registerTool(
	"capture_region",
	{
		title: "Capture Screen Region",
		description: "Capture a specific rectangular region of the screen by coordinates",
		inputSchema: {
			x: z
				.number()
				.int()
				.min(0)
				.describe("X coordinate of the top-left corner of the region (must be non-negative integer)"),
			y: z
				.number()
				.int()
				.min(0)
				.describe("Y coordinate of the top-left corner of the region (must be non-negative integer)"),
			width: z
				.number()
				.int()
				.min(1)
				.describe("Width of the region to capture in pixels (must be positive integer)"),
			height: z
				.number()
				.int()
				.min(1)
				.describe("Height of the region to capture in pixels (must be positive integer)"),
			compress: z
				.boolean()
				.optional()
				.describe("Whether to compress the PNG file to reduce size (default: false)"),
			returnData: z
				.boolean()
				.optional()
				.describe("If true, return base64 encoded image data instead of file path (size limit: 1MB, default: false)")
		}
	},
	async ({ x, y, width, height, compress, returnData }) => {
		return await captureRegion(x, y, width, height, { compress, returnData });
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);

	const platformInfo = getPlatformInfo();
	console.error("Screenshot MCP Server running on stdio");
	console.error(
		`Platform: ${platformInfo.platform} (Screenshots: ${platformInfo.supportsScreenshots ? "✅ Supported" : "❌ Not Supported"})`
	);

	if (!platformInfo.supportsScreenshots) {
		console.error(`Screenshot method: ${platformInfo.screenshotMethod}`);
		console.error(`Limitations: ${platformInfo.limitations.join(", ")}`);
	}
}

main().catch(error => {
	console.error("Server error:", error);
	process.exit(1);
});
