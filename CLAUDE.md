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

- **MCP Server** (`src/index.ts`): Built using the modern `@modelcontextprotocol/sdk` v1.17.2 with the `McpServer` class and `registerTool` API
- **Screenshot Tool**: Exposes a `take_screenshot` tool that accepts an `appName` parameter
- **Shell Script Integration** (`winshot.sh`): Handles the actual screenshot capture using macOS-specific AppleScript and `screencapture`

### Key Technical Details

- **Runtime**: Uses Bun with native APIs (`Bun.spawn`, `import.meta.dir`) for optimal performance
- **Validation**: Zod schemas for type-safe input validation
- **Transport**: StdioServerTransport for MCP communication
- **Process Management**: Uses `Bun.spawn` to execute the screenshot script and capture stdout/stderr

### Screenshot Flow

1. Tool receives `appName` parameter
2. Executes `winshot.sh` script via `Bun.spawn`
3. Script uses AppleScript to find running app (case-insensitive matching)
4. Captures screenshot using various methods (window ID, bounds, or interactive)
5. Returns file path or error message

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

- macOS (required for `winshot.sh` script functionality)
- Bun >= 1.0.0
- Applications must be running to be screenshotted
