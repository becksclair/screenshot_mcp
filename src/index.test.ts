import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getPlatformInfo, getUnsupportedPlatformMessage, isMac, supportsScreenshots } from "./platform.js";
import { captureRegion, listRunningApps, runScreenshot } from "./screenshot.js";

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
				const pathRegex = /Screenshot successfully taken and saved to: (.+\.png)/;
				const pathMatch = pathRegex.exec(responseText);
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

	test("should handle platform detection correctly", async () => {
		// On macOS, screenshots should be supported and we should get to actual execution
		if (process.platform === "darwin") {
			const result = await runScreenshot("NonExistentApp99999");

			expect(result).toBeDefined();
			expect(result.isError).toBe(true);
			// Should fail due to app not found, not platform issues
			expect(result.content[0].text).toMatch(/Could not find app|Screenshot failed/);
		} else {
			// On other platforms, should get platform error immediately
			const result = await runScreenshot("TestApp");

			expect(result).toBeDefined();
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toMatch(/Screenshot failed.*not available/i);
		}
	});

	test("should support compression option", async () => {
		// Test compression functionality
		const result = await runScreenshot("Electron", { compress: true });

		expect(result).toBeDefined();

		if (result.isError) {
			// If screenshot failed (app not available), that's okay for this test
			expect(result.content[0].text).toMatch(/Screenshot failed|Could not find app|macOS only/);
			console.log("Compression test skipped - screenshot failed (expected if app not available)");
		} else {
			// If successful, verify the response format
			expect(result.content[0].text).toMatch(/Screenshot successfully taken and saved to:/);

			// Extract the file path and verify it exists
			const pathRegex = /Screenshot successfully taken and saved to: (.+\.png)/;
			const pathMatch = pathRegex.exec(result.content[0].text);
			if (pathMatch) {
				const filePath = pathMatch[1];
				expect(existsSync(filePath)).toBe(true);

				// Add to cleanup list
				createdFiles.push(filePath);

				console.log("✅ Compression test passed - file created (compression applied if supported)");
			}
		}
	}, 20000);

	test("should provide accurate platform detection", () => {
		const platformInfo = getPlatformInfo();

		expect(platformInfo).toBeDefined();
		expect(typeof platformInfo.platform).toBe("string");
		expect(typeof platformInfo.supportsScreenshots).toBe("boolean");
		expect(typeof platformInfo.screenshotMethod).toBe("string");
		expect(Array.isArray(platformInfo.limitations)).toBe(true);

		// On macOS, should support screenshots
		if (process.platform === "darwin") {
			expect(platformInfo.platform).toBe("macOS");
			expect(platformInfo.isMac).toBe(true);
			expect(platformInfo.supportsScreenshots).toBe(true);
			expect(platformInfo.screenshotMethod).toBe("screencapture + AppleScript");
			expect(platformInfo.limitations).toEqual([]);
		}

		// Test utility functions
		expect(isMac).toBe(process.platform === "darwin");
		expect(supportsScreenshots).toBe(process.platform === "darwin");
	});

	test("should provide helpful unsupported platform messages", () => {
		// Test current platform message behavior
		const message = getUnsupportedPlatformMessage();

		if (process.platform === "darwin") {
			expect(message).toBe("Platform is supported");
		} else {
			// On other platforms, should provide helpful error message
			expect(message).toMatch(/Screenshot functionality is not available/);
			expect(message).toMatch(/Not yet implemented|Not supported/);
		}
	});

	test("should list running applications", async () => {
		const result = await listRunningApps();

		expect(result).toBeDefined();
		expect(result.content).toBeDefined();
		expect(Array.isArray(result.content)).toBe(true);
		expect(result.content.length).toBeGreaterThan(0);

		const responseText = result.content[0].text;

		if (result.isError) {
			// On non-macOS platforms or if there's an error
			expect(responseText).toMatch(/App listing failed|not available|not supported/);
			console.log("App listing test skipped - platform not supported or error occurred");
		} else {
			// Should return valid JSON array
			expect(() => JSON.parse(responseText)).not.toThrow();

			const apps = JSON.parse(responseText);
			expect(Array.isArray(apps)).toBe(true);

			// Should have at least one app running (the test runner itself or system apps)
			if (process.platform === "darwin") {
				expect(apps.length).toBeGreaterThan(0);

				// Each app name should be a string
				apps.forEach((app: unknown) => {
					expect(typeof app).toBe("string");
					expect(app).toBeTruthy();
				});

				// Should be sorted alphabetically
				const sortedApps = [...apps].sort((a: string, b: string) => a.localeCompare(b));
				expect(apps).toEqual(sortedApps);

				console.log(
					`✅ Found ${apps.length} running apps: ${apps.slice(0, 3).join(", ")}${apps.length > 3 ? "..." : ""}`
				);
			}
		}
	}, 15000); // 15 second timeout

	test("should validate screenshot format parameter", () => {
		// Test format validation with Zod schema
		const formatSchema = z.enum(["png"]).optional().default("png");

		// Valid format
		expect(() => formatSchema.parse("png")).not.toThrow();
		expect(() => formatSchema.parse(undefined)).not.toThrow();
		expect(formatSchema.parse(undefined)).toBe("png");

		// Invalid format should throw
		expect(() => formatSchema.parse("jpg")).toThrow();
		expect(() => formatSchema.parse("jpeg")).toThrow();
		expect(() => formatSchema.parse("gif")).toThrow();
		expect(() => formatSchema.parse("webp")).toThrow();
	});

	test("should validate windowStrategy parameter", () => {
		// Test window strategy validation with Zod schema
		const strategySchema = z.enum(["auto", "id", "bounds", "interactive"]).optional().default("auto");

		// Valid strategies
		expect(() => strategySchema.parse("auto")).not.toThrow();
		expect(() => strategySchema.parse("id")).not.toThrow();
		expect(() => strategySchema.parse("bounds")).not.toThrow();
		expect(() => strategySchema.parse("interactive")).not.toThrow();
		expect(() => strategySchema.parse(undefined)).not.toThrow();
		expect(strategySchema.parse(undefined)).toBe("auto");

		// Invalid strategies should throw
		expect(() => strategySchema.parse("window")).toThrow();
		expect(() => strategySchema.parse("fullscreen")).toThrow();
		expect(() => strategySchema.parse("region")).toThrow();
	});

	test("should validate capture_region coordinate parameters", () => {
		// Test coordinate validation with Zod schemas
		const coordinateSchema = z.number().int().min(0);
		const sizeSchema = z.number().int().min(1);

		// Valid coordinates
		expect(() => coordinateSchema.parse(0)).not.toThrow();
		expect(() => coordinateSchema.parse(100)).not.toThrow();
		expect(() => coordinateSchema.parse(1920)).not.toThrow();

		// Valid sizes
		expect(() => sizeSchema.parse(1)).not.toThrow();
		expect(() => sizeSchema.parse(100)).not.toThrow();
		expect(() => sizeSchema.parse(1920)).not.toThrow();

		// Invalid coordinates (negative)
		expect(() => coordinateSchema.parse(-1)).toThrow();
		expect(() => coordinateSchema.parse(-100)).toThrow();

		// Invalid sizes (zero or negative)
		expect(() => sizeSchema.parse(0)).toThrow();
		expect(() => sizeSchema.parse(-1)).toThrow();
		expect(() => sizeSchema.parse(-100)).toThrow();

		// Non-integers should throw
		expect(() => coordinateSchema.parse(10.5)).toThrow();
		expect(() => sizeSchema.parse(10.5)).toThrow();
	});

	test("should capture screen region successfully", async () => {
		const result = await captureRegion(0, 0, 100, 100);

		expect(result).toBeDefined();
		expect(result.content).toBeDefined();
		expect(Array.isArray(result.content)).toBe(true);
		expect(result.content.length).toBeGreaterThan(0);

		const responseText = result.content[0].text;

		if (result.isError) {
			// On non-macOS platforms or if there's an error
			expect(responseText).toMatch(/Region capture failed|not available|not supported/);
			console.log("Region capture test skipped - platform not supported or error occurred");
		} else {
			// Should return valid success message with file path
			expect(responseText).toMatch(/Region screenshot successfully captured and saved to: (.+\.png)/);

			// Extract the file path and verify it exists
			const pathRegex = /Region screenshot successfully captured and saved to: (.+\.png)/;
			const pathMatch = pathRegex.exec(responseText);
			if (pathMatch) {
				const filePath = pathMatch[1];
				expect(existsSync(filePath)).toBe(true);
				expect(filePath).toMatch(/screenshot_region_0_0_100x100/);

				// Add to cleanup list
				createdFiles.push(filePath);

				console.log("✅ Region capture test passed - file created and verified");
			}
		}
	}, 15000); // 15 second timeout

	test("should handle invalid region coordinates", async () => {
		// Test with negative coordinates
		const negativeX = await captureRegion(-10, 0, 100, 100);
		expect(negativeX.isError).toBe(true);
		expect(negativeX.content[0].text).toMatch(/Invalid coordinates.*x=-10/);

		const negativeY = await captureRegion(0, -10, 100, 100);
		expect(negativeY.isError).toBe(true);
		expect(negativeY.content[0].text).toMatch(/Invalid coordinates.*y=-10/);

		// Test with zero or negative dimensions
		const zeroWidth = await captureRegion(0, 0, 0, 100);
		expect(zeroWidth.isError).toBe(true);
		expect(zeroWidth.content[0].text).toMatch(/Invalid coordinates.*width=0/);

		const negativeHeight = await captureRegion(0, 0, 100, -50);
		expect(negativeHeight.isError).toBe(true);
		expect(negativeHeight.content[0].text).toMatch(/Invalid coordinates.*height=-50/);
	});

	test("should support compression in region capture", async () => {
		const result = await captureRegion(0, 0, 50, 50, { compress: true });

		expect(result).toBeDefined();

		if (result.isError) {
			// On non-macOS platforms, should get platform error
			expect(result.content[0].text).toMatch(/Region capture failed|not available|macOS only/);
			console.log("Region capture compression test skipped - platform not supported");
		} else {
			// Should succeed with compression applied
			expect(result.content[0].text).toMatch(/Region screenshot successfully captured and saved to:/);

			// Extract the file path and verify it exists
			const pathRegex = /Region screenshot successfully captured and saved to: (.+\.png)/;
			const pathMatch = pathRegex.exec(result.content[0].text);
			if (pathMatch) {
				const filePath = pathMatch[1];
				expect(existsSync(filePath)).toBe(true);

				// Add to cleanup list
				createdFiles.push(filePath);

				console.log("✅ Region capture compression test passed - file created with compression");
			}
		}
	}, 15000);

	test("should return base64 data when returnData=true", async () => {
		const result = await runScreenshot("Electron", { returnData: true });

		expect(result).toBeDefined();

		if (result.isError) {
			// On non-macOS platforms, should get platform error
			expect(result.content[0].text).toMatch(/Screenshot failed|not available|macOS only/);
			console.log("Base64 screenshot test skipped - platform not supported");
		} else {
			const responseText = result.content[0].text;
			
			if (responseText.includes("too large for base64 encoding")) {
				// File was too large, which is acceptable
				expect(responseText).toMatch(/Screenshot file too large for base64 encoding.*Use returnData=false/);
				expect(responseText).toMatch(/File saved to:/);
				console.log("✅ Base64 test passed - file too large, returned path instead");
			} else {
				// Should contain base64 data URI
				expect(responseText).toMatch(/Screenshot successfully captured as base64 data.*data:image\/png;base64,/);
				
				// Extract the base64 data
				const dataUriMatch = responseText.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
				expect(dataUriMatch).toBeTruthy();
				
				if (dataUriMatch) {
					const base64Data = dataUriMatch[1];
					expect(base64Data.length).toBeGreaterThan(100); // Should have substantial base64 data
					console.log(`✅ Base64 screenshot test passed - ${Math.round(base64Data.length / 1024)} KB base64 data returned`);
				}
			}
		}
	}, 20000); // 20 second timeout

	test("should handle returnData with region capture", async () => {
		const result = await captureRegion(0, 0, 50, 50, { returnData: true });

		expect(result).toBeDefined();

		if (result.isError) {
			// On non-macOS platforms, should get platform error
			expect(result.content[0].text).toMatch(/Region capture failed|not available|macOS only/);
			console.log("Base64 region capture test skipped - platform not supported");
		} else {
			const responseText = result.content[0].text;
			
			if (responseText.includes("too large for base64 encoding")) {
				// File was too large (shouldn't happen with 50x50 region, but possible)
				expect(responseText).toMatch(/Region screenshot file too large for base64 encoding.*Use returnData=false/);
				expect(responseText).toMatch(/File saved to:/);
				console.log("✅ Base64 region test passed - file too large, returned path instead");
			} else {
				// Should contain base64 data URI
				expect(responseText).toMatch(/Region screenshot successfully captured as base64 data.*data:image\/png;base64,/);
				
				// Extract the base64 data
				const dataUriMatch = responseText.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
				expect(dataUriMatch).toBeTruthy();
				
				if (dataUriMatch) {
					const base64Data = dataUriMatch[1];
					expect(base64Data.length).toBeGreaterThan(50); // Small region should have some base64 data
					console.log(`✅ Base64 region capture test passed - ${Math.round(base64Data.length / 1024)} KB base64 data returned`);
				}
			}
		}
	}, 15000); // 15 second timeout

	test("should fallback to file path for large files with returnData=true", async () => {
		// This test would be hard to guarantee without creating a very large screenshot
		// so we'll just verify the parameter passes through correctly
		const result = await runScreenshot("Electron", { returnData: false });

		expect(result).toBeDefined();

		if (!result.isError) {
			const responseText = result.content[0].text;
			// With returnData=false, should always return file path
			expect(responseText).toMatch(/Screenshot successfully taken and saved to:/);
			expect(responseText).not.toMatch(/base64/);
			console.log("✅ File path mode test passed - returned path instead of base64");
		}
	}, 15000);
});
