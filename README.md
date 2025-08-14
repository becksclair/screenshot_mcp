# Screenshot MCP Server

A Model Context Protocol (MCP) server that provides screenshot functionality using the `winshot.sh` script, built with Bun.

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- macOS (required for `winshot.sh` script)
- Running applications to screenshot

## Installation

```bash
bun install
```

## Usage

### Development
```bash
bun run dev
```

### Production
```bash
bun start
```

### Build
```bash
bun run build
```

### Testing
```bash
bun test
```

### Type Checking
```bash
bun run typecheck
```

## MCP Tool

The server provides a `take_screenshot` tool that:

- **Input**: `appName` (string) - The name of the application to screenshot
- **Output**: Path to the saved screenshot file

### Example Usage

```json
{
  "name": "take_screenshot",
  "arguments": {
    "appName": "Visual Studio Code"
  }
}
```

## Project Structure

```
screenshot_mcp/
├── src/
│   ├── index.ts          # Main MCP server using McpServer API
│   └── index.test.ts     # Tests with modern API validation
├── winshot.sh            # Screenshot script
├── bunfig.toml           # Bun configuration
├── package.json          # Project metadata
└── tsconfig.json         # TypeScript configuration
```

## Features

- ✨ Built with Bun for fast performance and modern JavaScript support
- 🚀 Uses latest @modelcontextprotocol/sdk v1.17.2 with modern McpServer API
- 🔧 Uses Bun's native APIs (`Bun.spawn`, `import.meta.dir`) for optimal performance
- 📸 Integrates seamlessly with existing `winshot.sh` script for macOS screenshots
- 🧪 Comprehensive test suite with Bun's fast test runner
- 🔍 Zod schema validation for type-safe tool input handling
- 📦 Optimized TypeScript configuration specifically for Bun runtime
- 🎯 Modern MCP tool registration with `registerTool` API