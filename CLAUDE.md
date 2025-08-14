# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Build:**

```bash
bun run build
```

**Development (with hot reload):**

```bash
bun run dev
```

**Testing:**

```bash
bun test
```

**Type checking:**

```bash
bun run typecheck
```

**Linting/formatting:**

```bash
bun run check
```

## Architecture Overview

This is a Model Context Protocol (MCP) server that provides screenshot functionality for macOS applications. The architecture consists of:

### Core Components

- **MCP Server** (`src/index.ts`): Built using the modern `@modelcontextprotocol/sdk` v1.17.2 with the `McpServer` class and `registerTool` API.
- **Screenshot Tools**: `take_screenshot`, `list_running_apps`, `capture_region` exposed via the server.
- **Pure TypeScript Implementation** (`src/winshot.ts`): Replaces the earlier shell script. Handles app discovery (AppleScript), strategy selection (window id / bounds / interactive / fallback), screencapture invocation, optional compression, and base64 encoding.

### Key Technical Details

- **Runtime**: Uses Bun with native APIs (`Bun.spawn`, `import.meta.dir`) for optimal performance
- **Validation**: Zod schemas for type-safe input validation
- **Transport**: StdioServerTransport for MCP communication
- **Process Management**: Uses `Bun.spawn` to execute the screenshot script and capture stdout/stderr

### Screenshot Flow

1. Tool receives validated parameters (Zod schemas in `index.ts`).
2. `runScreenshot` delegates to `screenshotApp` in `winshot.ts` (no shell script).
3. AppleScript enumerates processes and window data.
4. Strategy chosen (auto → window id → bounds → interactive → frontmost fallback).
5. `screencapture` runs; optional compression via `sips`.
6. Result mapped to MCP tool response (file path or base64 data URI, size-limited).

### Testing Strategy

- Uses Bun's native test runner
- Tests include API validation, schema validation, and integration tests
- Integration tests handle app availability gracefully
- Automatic cleanup of test screenshot files

### Code Style

- Uses Biome for formatting and linting
- Tab indentation (4 spaces width)
- 120 character line width
- Semicolons required
- No trailing commas

## Platform Requirements

- macOS (current implementation relies on AppleScript + `screencapture`)
- Bun >= 1.0.0
- Target application must be running and have a window (else interactive fallback)
