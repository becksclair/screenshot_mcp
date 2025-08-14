#!/usr/bin/env bun

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join } from "path";

const projectRoot = import.meta.dir;

const server = new Server(
  {
    name: "screenshot-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "take_screenshot",
        description: "Take a screenshot of the specified app and return the screenshot file path",
        inputSchema: {
          type: "object",
          properties: {
            appName: {
              type: "string",
              description: "The name of the app to screenshot (e.g., 'Visual Studio Code', 'Safari')",
            },
          },
          required: ["appName"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "take_screenshot") {
    const appName = request.params.arguments?.appName as string;
    
    if (!appName) {
      return {
        content: [
          {
            type: "text",
            text: "Error: appName parameter is required",
          },
        ],
      };
    }

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
      };
    }
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${request.params.name}`,
      },
    ],
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Screenshot MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});