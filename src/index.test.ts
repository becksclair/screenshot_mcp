import { describe, test, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

describe("screenshot-mcp", () => {
  test("should have valid project structure", () => {
    expect(import.meta.dir).toBeDefined();
    expect(typeof import.meta.dir).toBe("string");
  });

  test("should be able to construct script path", () => {
    const { join } = require("path");
    const scriptPath = join(import.meta.dir, "..", "winshot.sh");
    expect(scriptPath).toContain("winshot.sh");
  });

  test("should create MCP server with modern API", () => {
    const server = new McpServer({
      name: "test-server",
      version: "1.0.0",
    });

    expect(server).toBeDefined();
  });

  test("should register tools with McpServer", () => {
    const server = new McpServer({
      name: "test-server",
      version: "1.0.0",
    });

    // Register a test tool to verify the API works
    server.registerTool(
      "test_tool",
      {
        title: "Test Tool",
        description: "A test tool for validation",
        inputSchema: {
          message: z.string().describe("A test message"),
        },
      },
      async ({ message }) => ({
        content: [{ type: "text", text: `Echo: ${message}` }],
      })
    );

    expect(server).toBeDefined();
  });

  test("should validate zod schema", () => {
    const schema = z.string().describe("Test string");
    expect(() => schema.parse("test")).not.toThrow();
    expect(() => schema.parse(123)).toThrow();
  });

  test("should validate complex zod schema", () => {
    const appNameSchema = z.string().describe("The name of the app to screenshot");
    
    expect(() => appNameSchema.parse("Visual Studio Code")).not.toThrow();
    expect(() => appNameSchema.parse("")).not.toThrow(); // Empty string is valid
    expect(() => appNameSchema.parse(null)).toThrow();
    expect(() => appNameSchema.parse(undefined)).toThrow();
  });
});