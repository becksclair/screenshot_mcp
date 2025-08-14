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

### Inline Image Embedding

Both `take_screenshot` and `capture_region` now return the actual PNG image inline (as a Model Context Protocol `image` content item) when the file size is below an embedding threshold.

Response content order (success with embedding):

1. `{ type: "image", mimeType: "image/png", data: "<base64>" }`
2. `{ type: "text", text: "Screenshot successfully taken and saved to: /abs/path.png (embedded inline, 842 KB)" }`

If the image exceeds the threshold, only a text item is returned, including a note:
`Screenshot successfully taken and saved to: /abs/path.png (not embedded; 2100 KB exceeds 1000 KB limit)`

#### Size Threshold

- Default: 1,000,000 bytes (approx 1 MB)
- Override per call with `inlineMaxBytes`
- Global override via environment variable `MCP_SCREENSHOT_EMBED_MAX_BYTES`
- If `returnData: true` is set, behavior is the same except it explicitly opts into attempting an embed (still subject to size threshold).

#### Parameters

`take_screenshot` extra fields:

- `returnData?: boolean` – request embedding (auto-embedding also occurs when small even if false)
- `inlineMaxBytes?: number` – per-call byte threshold override

`capture_region` extra fields:

- `returnData?: boolean`
- `inlineMaxBytes?: number`

#### Notes

- Backwards compatibility: Existing clients parsing the text line still work; the text item remains with the same leading phrase `Screenshot successfully taken and saved to:` / `Region screenshot successfully captured and saved to:`.
- The image base64 data is not prefixed with a data URI; it is raw base64 per MCP `image` content spec.
- Large images are not read into memory twice; the file is read once only when embedding.
- Compression (`compress: true`) is best-effort; it might not reduce size enough (or at all) for embedding. The size gate always uses the final file size after any compression.

#### Example Request with Overrides

```jsonc
{
  "name": "take_screenshot",
  "arguments": {
    "appName": "Visual Studio Code",
    "compress": true,
    "inlineMaxBytes": 1500000
  }
}
```

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
