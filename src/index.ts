#!/usr/bin/env bun

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "path";

const projectRoot = import.meta.dir;

// Create an MCP server using the modern API
const server = new McpServer({
  name: "screenshot-mcp",
  version: "1.0.0",
});

// Register the screenshot tool using the modern registerTool API
server.registerTool(
  "take_screenshot",
  {
    title: "Take Screenshot",
    description: "Take a screenshot of the specified app and return the screenshot file path",
    inputSchema: {
      appName: z.string().describe("The name of the app to screenshot (e.g., 'Visual Studio Code', 'Safari')"),
    },
  },
  async ({ appName }) => {
    try {
      const scriptPath = join(projectRoot, "..", "winshot.sh");
      
      const proc = Bun.spawn(["bash", scriptPath, appName], {
        stdout: "pipe",
        stderr: "pipe",
        stdin: "ignore",
      });

      const [stdout, stderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ]);

      const result = {
        stdout,
        stderr,
        code: await proc.exited,
      };

      if (result.code !== 0) {
        return {
          content: [
            {
              type: "text",
              text: `Screenshot failed: ${result.stderr || result.stdout}`,
            },
          ],
          isError: true,
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
              text: `Screenshot taken but could not determine file path. Output: ${result.stdout}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Screenshot successfully taken and saved to: ${screenshotPath}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Screenshot MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});