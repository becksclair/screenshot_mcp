#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runScreenshot } from "./screenshot.js";

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
				.describe("The name of the app to screenshot (e.g., 'Visual Studio Code', 'Safari')")
		}
	},
	async ({ appName }) => {
		return await runScreenshot(appName);
	}
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("Screenshot MCP Server running on stdio");
}

main().catch(error => {
	console.error("Server error:", error);
	process.exit(1);
});
