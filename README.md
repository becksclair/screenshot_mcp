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

- **Input**:

  - `appName` (string) - The name of the application to screenshot
  - `compress` (boolean, optional) - Whether to apply PNG compression to reduce file size

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

**With compression:**

```json
{
  "name": "take_screenshot",
  "arguments": {
    "appName": "Visual Studio Code",
    "compress": true
  }
}
```

## Project Structure

```tree
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

## Performance

| Metric | Value | Description |
|--------|-------|-------------|
| **Source Size** | 11.0 KB | TypeScript source code size |
| **Bundle Size** | 592 KB | Compiled JavaScript bundle |
| **Cold Start** | 74.2 ± 2.2 ms | Server startup time (mean ± std dev) |
| **Bundle Ratio** | 53.8x | Bundle size vs source size |

### Screenshot Capture Performance

| Scenario | Time per Screenshot | Total Time (3 captures) | Success Rate |
|----------|-------------------|-------------------------|--------------|
| **Sequential** | 2,587 ms | 7,761 ms | 100% |
| **Parallel** | 1,377 ms | 4,130 ms | 100% |
| **Speedup** | 1.9x faster | 1.9x faster | No degradation |

**Parallel Efficiency:** 62.6% (limited by macOS screenshot system bottlenecks)

**Recommendations:**

- ✅ Use parallel captures for multiple screenshots (1.9x speedup)
- ⚠️ Consider rate limiting for concurrent requests to avoid system overload
- 💡 Optimal concurrency appears to be 2-3 simultaneous captures

### Compression Feature

The optional `compress: true` parameter applies PNG optimization using macOS `sips` utility:

- **Method**: PNG format recompression with default optimization
- **Typical savings**: 0-5% for screenshots (already well-compressed by screencapture)
- **Use case**: Enable for storage-constrained environments or batch operations
- **Performance impact**: ~50-100ms additional processing time per image

*Performance measurements taken on macOS with Bun v1.2.20. Cold start time measured using hyperfine with 10 runs and 3 warmup iterations.*
