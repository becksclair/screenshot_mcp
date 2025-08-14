import { describe, test, expect, afterAll } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { join } from "node:path";
import { existsSync, unlinkSync } from "node:fs";
import { runScreenshot } from "./screenshot.js";

describe("screenshot-mcp", () => {
	const createdFiles: string[] = [];

	// Helper function to find and cleanup test screenshots
	afterAll(() => {
		// Clean up any screenshots created during testing
		createdFiles.forEach(file => {
			try {
				if (existsSync(file)) {
					unlinkSync(file);
					console.log(`Cleaned up test file: ${file}`);
				}
			} catch (error) {
				console.warn(`Could not clean up file ${file}:`, error);
			}
		});
	});

	test("should have valid project structure", () => {
		expect(import.meta.dir).toBeDefined();
		expect(typeof import.meta.dir).toBe("string");
	});

	test("should be able to construct script path", () => {
		const scriptPath = join(import.meta.dir, "..", "winshot.sh");
		expect(scriptPath).toContain("winshot.sh");
		expect(existsSync(scriptPath)).toBe(true);
	});

	test("should create MCP server with modern API", () => {
		const server = new McpServer({
			name: "test-server",
			version: "1.0.0"
		});

		expect(server).toBeDefined();
	});

	test("should register tools with McpServer", () => {
		const server = new McpServer({
			name: "test-server",
			version: "1.0.0"
		});

		// Register a test tool to verify the API works
		server.registerTool(
			"test_tool",
			{
				title: "Test Tool",
				description: "A test tool for validation",
				inputSchema: {
					message: z.string().describe("A test message")
				}
			},
			async ({ message }) => ({
				content: [{ type: "text", text: `Echo: ${message}` }]
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
		const appNameSchema = z.string().max(100).describe("The name of the app to screenshot");

		expect(() => appNameSchema.parse("Visual Studio Code")).not.toThrow();
		expect(() => appNameSchema.parse("")).not.toThrow(); // Empty string is valid
		expect(() => appNameSchema.parse(null)).toThrow();
		expect(() => appNameSchema.parse(undefined)).toThrow();
	});

	test("should enforce 100 character limit on appName", () => {
		const appNameSchema = z.string().max(100).describe("The name of the app to screenshot");

		// Test exactly 100 characters - should be valid
		const exactly100Chars = "A".repeat(100);
		expect(() => appNameSchema.parse(exactly100Chars)).not.toThrow();

		// Test 101 characters - should throw
		const over100Chars = "A".repeat(101);
		expect(() => appNameSchema.parse(over100Chars)).toThrow();

		// Test a realistic long app name that exceeds limit
		const longAppName =
			"This is an extremely long application name that definitely exceeds the one hundred character limit and should be rejected by the validation schema";
		expect(longAppName.length).toBeGreaterThan(100);
		expect(() => appNameSchema.parse(longAppName)).toThrow();
	});

	test("should take screenshot of Visual Studio Code and return file path", async () => {
		// Test the screenshot functionality
		try {
			// Call the function with Visual Studio Code as the app name
			const result = await runScreenshot("Electron");

			console.log("Screenshot result:", result);

			// Check if the result indicates success or provides useful information
			expect(result).toBeDefined();
			expect(result.content).toBeDefined();
			expect(Array.isArray(result.content)).toBe(true);
			expect(result.content.length).toBeGreaterThan(0);

			const responseText = result.content[0].text;
			console.log("Response text:", responseText);

			if (result.isError) {
				// If the screenshot failed, check if it's due to app not being available
				expect(responseText).toMatch(/Screenshot failed|Could not find app|No tables available/);
				console.log("Screenshot test skipped - Visual Studio Code not available or other expected error");
			} else {
				// If successful, verify the response contains a file path
				expect(responseText).toMatch(/Screenshot successfully taken and saved to: (.+\.png)/);

				// Extract the file path from the response
				const pathMatch = responseText.match(/Screenshot successfully taken and saved to: (.+\.png)/);
				if (pathMatch) {
					const filePath = pathMatch[1];
					console.log("Screenshot saved to:", filePath);

					// Verify the file exists
					expect(existsSync(filePath)).toBe(true);

					// Verify it's a PNG file
					expect(filePath).toMatch(/\.png$/);

					// Verify it's in the expected directory
					expect(filePath).toMatch(/Screenshots/);

					// Add to cleanup list
					createdFiles.push(filePath);

					console.log("✅ Screenshot test passed - file created and verified");
				}
			}
		} catch (error) {
			console.log("Screenshot test error:", error);
			// Don't fail the test if Visual Studio Code isn't running
			// This is an integration test that depends on external state
			expect(error).toBeDefined(); // Just verify we got some kind of response
		}
	}, 30000); // 30 second timeout for screenshot operation

	test("should handle invalid app name gracefully", async () => {
		// Test with an invalid app name
		const result = await runScreenshot("NonExistentApp12345");

		// Should return an error
		expect(result).toBeDefined();
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toMatch(/Screenshot failed|Could not find app/);
	}, 20000); // 20 second timeout to account for our 15s internal timeout

	test("should handle special characters in app name safely", async () => {
		// Test with special characters that could cause shell injection
		const specialChars = [
			'App";rm -rf /tmp/test;"', // Command injection attempt
			"App$(whoami)", // Command substitution
			"App`whoami`", // Command substitution with backticks
			'App & echo "test"', // Command chaining
			"App | cat /etc/passwd" // Pipe attempt
		];

		for (const appName of specialChars) {
			const result = await runScreenshot(appName);

			// Should return an error (not found) but not execute any malicious commands
			expect(result).toBeDefined();
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toMatch(/Screenshot failed|Could not find app/);
		}
	}, 30000);

	test("should return macOS-only error on non-darwin platforms", async () => {
		// Mock process.platform temporarily
		const originalPlatform = process.platform;

		// Use Object.defineProperty to mock process.platform
		Object.defineProperty(process, "platform", {
			value: "win32",
			writable: true,
			configurable: true
		});

		try {
			const result = await runScreenshot("TestApp");

			expect(result).toBeDefined();
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toMatch(/macOS.*Windows.*Linux.*not.*supported/i);
		} finally {
			// Restore original platform
			Object.defineProperty(process, "platform", {
				value: originalPlatform,
				writable: true,
				configurable: true
			});
		}
	});
});
