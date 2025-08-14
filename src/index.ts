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
const takeScreenshotSchema = {
	appName: z.string().max(100).describe("The name of the app to screenshot (e.g., 'Visual Studio Code', 'Safari')"),
	compress: z.boolean().optional().describe("Whether to compress the PNG file to reduce size (default: false)"),
	format: z.enum(["png"]).optional().default("png").describe("Screenshot format (currently only 'png' is supported)"),
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
		.describe(
			"If true, attempt to embed image data (subject to size threshold). Image still returned automatically when small."
		),
	inlineMaxBytes: z
		.number()
		.int()
		.positive()
		.optional()
		.describe(
			"Optional override for maximum embedded image size in bytes (default 1,000,000; can also set MCP_SCREENSHOT_EMBED_MAX_BYTES env)"
		)
} as const;

server.registerTool(
	"take_screenshot",
	{
		title: "Take Screenshot",
		description: "Take a screenshot of the specified app and return the screenshot file path",
		// Provide raw shape; SDK performs minimal validation, we still parse with Zod inside
		// @ts-expect-error SDK raw shape typing mismatch; using zod schemas internally
		inputSchema: takeScreenshotSchema
	},
	async (args: Record<string, unknown>) => {
		const parsed = z.object(takeScreenshotSchema).safeParse(args);
		if (!parsed.success) {
			return {
				content: [{ type: "text", text: `Screenshot failed: Invalid input - ${parsed.error.message}` }],
				isError: true
			} as const;
		}
		const { appName, compress, format, windowStrategy, returnData, inlineMaxBytes } = parsed.data;
		if (format && format !== "png") {
			return {
				content: [
					{
						type: "text",
						text: `Screenshot failed: Format '${format}' is not supported. Only 'png' format is currently available.`
					}
				],
				isError: true
			} as const;
		}
		return await runScreenshot(appName, { compress, windowStrategy, returnData, inlineMaxBytes });
	}
);

// Register the list_running_apps tool
server.registerTool(
	"list_running_apps",
	{
		title: "List Running Apps",
		description: "Get a JSON array of currently running applications with visible windows",
		// empty schema
		inputSchema: {}
	},
	async () => await listRunningApps()
);

// Register the capture_region tool
const captureRegionSchema = {
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
	width: z.number().int().min(1).describe("Width of the region to capture in pixels (must be positive integer)"),
	height: z.number().int().min(1).describe("Height of the region to capture in pixels (must be positive integer)"),
	compress: z.boolean().optional().describe("Whether to compress the PNG file to reduce size (default: false)"),
	returnData: z
		.boolean()
		.optional()
		.describe(
			"If true, attempt to embed image data (subject to size threshold). Image still returned automatically when small."
		),
	inlineMaxBytes: z
		.number()
		.int()
		.positive()
		.optional()
		.describe(
			"Optional override for maximum embedded image size in bytes (default 1,000,000; can also set MCP_SCREENSHOT_EMBED_MAX_BYTES env)"
		)
} as const;

server.registerTool(
	"capture_region",
	{
		title: "Capture Screen Region",
		description: "Capture a specific rectangular region of the screen by coordinates",
		// @ts-expect-error SDK raw shape typing mismatch; using zod schemas internally
		inputSchema: captureRegionSchema
	},
	async (args: Record<string, unknown>) => {
		const parsed = z.object(captureRegionSchema).safeParse(args);
		if (!parsed.success) {
			return {
				content: [{ type: "text", text: `Region capture failed: Invalid input - ${parsed.error.message}` }],
				isError: true
			} as const;
		}
		const { x, y, width, height, compress, returnData, inlineMaxBytes } = parsed.data;
		return await captureRegion(x, y, width, height, { compress, returnData, inlineMaxBytes });
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
