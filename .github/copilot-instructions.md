# Copilot Instructions: screenshot-mcp

Purpose: Fast Bun-based MCP server exposing screenshot tools (take_screenshot, list_running_apps, capture_region) implemented purely in TypeScript (no shell script) on macOS.
Keep responses concrete, reflect existing patterns, and prefer minimal changes.

## Core Architecture

- Entry point: `src/index.ts` (also executable via shebang `#!/usr/bin/env bun`).
- Uses modern `McpServer` API from `@modelcontextprotocol/sdk` v1.17.2 with `StdioServerTransport`.
- Tools: `take_screenshot`, `list_running_apps`, `capture_region`.
- Screenshot logic: direct TypeScript (`src/winshot.ts`) spawns `osascript` + `screencapture`, parses output, selects strategy, optional compression & base64.
- Zod provides input validation (simple string schema with description). Keep using Zod for any new tool inputs.
- Tests (`src/index.test.ts`) duplicate screenshot logic for integration-style verification; they don't invoke the server object directly.

## Conventions & Patterns

- Runtime: Bun (ESM, TypeScript). Avoid Node-only APIs unless Bun supports them.
- Paths: All logic lives in TS; no external script path needed. Keep relative imports within `src/`.
- Error handling: Return `{ content: [{ type: 'text', text }], isError: true }` for failures rather than throwing so the MCP layer surfaces readable messages.
- Success response: single text item summarizing path; no binary streaming implemented.
- Output parsing: Regex `/Screenshot saved: (.+\.png)/` — if it fails, treat as soft success (no isError) but explain inability to determine path.
- Tests tolerate external environment variability (applications may not be running). Don't make tests brittle by asserting specific app availability.
- Style/format enforced by Biome (`bun run check`). Indentation is tabs in repo (see `biome.jsonc`). Maintain existing formatting.

## Commands

- Install deps: `bun install`.
- Dev (watch): `bun run dev`.
- Run server (stdio): `bun start` or execute built file after build.
- Build: `bun run build` outputs to `dist/` (target bun). Currently entry `src/index.ts`; additional files must be included if required at runtime.
- Test: `bun test` (fast; integration depends on macOS + GUI app presence).
- Type check only: `bun run typecheck`.
- Lint/format/fix: `bun run check` (Biome auto-fixes with --write enabled).

## Adding Tools

When adding a new tool:
1. Define with `server.registerTool(name, { title, description, inputSchema }, handler)` directly in `src/index.ts` (or factor to separate module if complexity grows; update instructions accordingly).
2. Use Zod schemas for every field with `.describe()` for clarity.
3. Keep handler async, return the standard shape (`{ content: [...], isError? }`). Avoid throwing unless truly exceptional.
4. Prefer Bun-native APIs (`Bun.spawn`, fetch, fs via Bun/Node compat) for performance.
5. Follow existing pattern for parsing external process output; if structured output expected, consider JSON parsing and fallback to textual error message.

## Testing Guidance

- Mirror logic in test file for isolated validation (current pattern). If refactoring, consider exporting pure helper functions instead of duplicating.
- Keep environment-sensitive assertions guarded (see screenshot test). Use regex patterns that allow variability.
- For new tools, add simple zod validation tests and at least one happy-path + one error-path test.

## Error / Edge Cases Already Considered

- Non-zero exit from script -> `isError: true`.
- Missing parseable screenshot path -> non-error informational response.
- Invalid input types rejected by Zod before handler runs.

## Implementation Notes (`winshot.ts`)

- Provides `screenshotApp(appName, {strategy, compress, returnData})` returning structured result.
- Strategies: auto|id|bounds|interactive with fallbacks; maintains verbose status lines for potential future logging.
- Base64 size gate ~1MB; large images return file path only.

## TypeScript & Build

- `tsconfig.json` is tuned for Bun (`moduleResolution: bundler`, `noEmit` true). Build relies on Bun bundler; don't add custom emit steps without adjusting instructions.
- Add new source files under `src/`; build includes them if imported from entry.

## Biome & Style

- Use tabs, 120 char line width, semicolons enforced. Let Biome fix formatting (`bun run check`) before committing large changes.

## Safe Changes Checklist (before PR / commit)

- Run: tests, typecheck, check (Biome), build.
- Ensure `take_screenshot` still functions on macOS; avoid introducing Node-only modules.

## What NOT to Do

- Don't replace `Bun.spawn` with Node's `child_process` unless required.
- Don't silently change the stdout parsing contract without updating tests & docs.
- Don't introduce global mutable state; keep tool handlers stateless (aside from local computations).

## Quick Reference Example

```ts
server.registerTool(
  "new_tool",
  { title: "New Tool", description: "Describe", inputSchema: { name: z.string().describe("User name") } },
  async ({ name }) => ({ content: [{ type: "text", text: `Hello ${name}` }] })
);
```

## If Expanding

- Factor repeated process-spawn logic into helper (e.g., `runScript(scriptPath, args): Promise<{stdout, stderr, code}>`).
- Consider exporting reusable parsing helpers and importing in tests instead of duplication.

(End of instructions. Ask maintainers if adding non-screenshot domain capabilities.)
