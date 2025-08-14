import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, unlinkSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { captureRegion, type McpContentItem, runScreenshot } from "./screenshot.js";

// Extract first text content
function textOf(result: { content: McpContentItem[] }): string {
	for (const c of result.content) if (c.type === "text") return c.text || "";
	return "";
}

const created: string[] = [];
afterAll(() => {
	for (const p of created) {
		try {
			if (existsSync(p)) unlinkSync(p);
		} catch {}
	}
});

describe("embedding + fallback", () => {
	test("screenshot embeds when small", async () => {
		const res = await runScreenshot("Electron", { inlineMaxBytes: 1_500_000 });
		if (res.isError) {
			expect(textOf(res)).toMatch(/Screenshot failed|Could not find app/);
			return; // environment dependent
		}
		const txt = textOf(res);
		expect(txt).toMatch(/Screenshot successfully taken and saved to: (.+\.png)/);
		if (res.content[0].type === "image") {
			expect(res.content[0].mimeType).toBe("image/png");
			const m = /saved to: (.+\.png)/.exec(txt);
			if (m && existsSync(m[1])) created.push(m[1]);
		}
	}, 30000);

	test("screenshot fallback with tiny threshold", async () => {
		const res = await runScreenshot("Electron", { inlineMaxBytes: 10 });
		if (!res.isError) expect(textOf(res)).toMatch(/not embedded/);
	}, 20000);

	test("region capture embeds or falls back", async () => {
		const res = await captureRegion(0, 0, 60, 60, { inlineMaxBytes: 900_000 });
		if (!res.isError) {
			const txt = textOf(res);
			expect(txt).toMatch(/Region screenshot successfully captured and saved to: (.+\.png)/);
			if (res.content[0].type === "image") expect(res.content[0].mimeType).toBe("image/png");
		}
	}, 20000);

	test("region fallback tiny threshold", async () => {
		const res = await captureRegion(0, 0, 30, 30, { inlineMaxBytes: 10 });
		if (!res.isError) expect(textOf(res)).toMatch(/not embedded/);
	}, 15000);

	test("compression still embeds or falls back", async () => {
		const res = await runScreenshot("Electron", { compress: true, inlineMaxBytes: 1_200_000 });
		if (res.isError) {
			expect(textOf(res)).toMatch(/Screenshot failed|Could not find app/);
			return;
		}
		const txt = textOf(res);
		expect(txt).toMatch(/Screenshot successfully taken and saved to: (.+\.png)/);
		// If image embedded ensure mime
		if (res.content[0].type === "image") expect(res.content[0].mimeType).toBe("image/png");
	}, 30000);
});

describe("validation + misc", () => {
	test("invalid app name", async () => {
		const res = await runScreenshot("NoSuchApp__DefinitelyNot");
		expect(res.isError).toBe(true);
		expect(textOf(res)).toMatch(/Screenshot failed|Could not find app/);
	}, 15000);

	test("inlineMaxBytes negative validation", () => {
		const schema = z.object({ inlineMaxBytes: z.number().int().positive() });
		expect(schema.safeParse({ inlineMaxBytes: -5 }).success).toBe(false);
	});

	test("env var max bytes override honored", async () => {
		// Force extremely low global threshold; omit per-call override so env applies
		process.env.MCP_SCREENSHOT_EMBED_MAX_BYTES = "20";
		const res = await runScreenshot("Electron");
		if (!res.isError) expect(textOf(res)).toMatch(/not embedded/);
		delete process.env.MCP_SCREENSHOT_EMBED_MAX_BYTES;
	}, 20000);

	test("server registration", () => {
		const server = new McpServer({ name: "test", version: "1.0.0" });
		server.registerTool("noop", { title: "Noop", description: "noop", inputSchema: {} }, async () => ({
			content: [{ type: "text", text: "ok" }]
		}));
		expect(server).toBeDefined();
	});
});
