# Screenshot MCP Server

A Model Context Protocol (MCP) server that provides screenshot functionality for macOS applications.

## Installation

### Quick Start (Recommended)

1. **Download the universal binary:**

   ```bash
   # Replace with actual release URL
   curl -L -o screenshot-mcp https://github.com/YOUR_USERNAME/screenshot-mcp/releases/latest/download/screenshot-mcp-universal
   chmod +x screenshot-mcp
   ```

2. **Test it works:**

   ```bash
   echo '{"jsonrpc": "2.0", "id": "test", "method": "tools/list"}' | ./screenshot-mcp
   ```

### Build from Source

**Requirements:** [Bun](https://bun.sh) >= 1.0.0, macOS

```bash
git clone https://github.com/YOUR_USERNAME/screenshot-mcp.git
cd screenshot-mcp
bun install
bun run build-universal  # Creates universal binary
```

## Configuration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "screenshot": {
      "command": "/path/to/screenshot-mcp"
    }
  }
}
```

### Other MCP Clients

Use the binary path in your MCP client configuration:

```json
{
  "command": "/usr/local/bin/screenshot-mcp"
}
```

## Usage

### Available Tools

- **`take_screenshot`** - Capture a screenshot of a specific app
- **`list_running_apps`** - Get list of running applications
- **`capture_region`** - Capture a specific screen region

### Example

```json
{
  "name": "take_screenshot",
  "arguments": {
    "appName": "Visual Studio Code",
    "compress": true
  }
}
```

## Development

```bash
bun run dev        # Development server with hot reload
bun test          # Run tests
bun run qa        # Run all quality checks
```

## Performance

- **Cold start**: ~74ms
- **Parallel screenshots**: 1.9x faster than sequential
- **Binary size**: 120MB universal binary (Intel + Apple Silicon)
- **Compression**: Optional PNG optimization (~50-100ms overhead)

## Platform Support

- **macOS**: ✅ Fully supported (Intel & Apple Silicon)
- **Linux**: 🚧 Planned (Wayland/X11)
- **Windows**: 🚧 Planned (PowerShell/Win32)

## Features

- Built with Bun for fast performance
- Universal binary supports both Intel and Apple Silicon Macs
- Self-contained executable (no dependencies required)
- Multiple screenshot tools and capture strategies
- Comprehensive test suite with type safety

## Project Structure

```text
screenshot_mcp/
├── src/
│   ├── index.ts          # Main MCP server
│   └── index.test.ts     # Test suite
├── src/winshot.ts        # Pure TypeScript screenshot implementation (replaces prior shell script)
├── dist/                 # Built binaries
└── package.json          # Build scripts
```

## License

MIT
