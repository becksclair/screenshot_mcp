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

## Platform Support

### macOS (✅ Fully Supported)

The primary platform with complete screenshot functionality:
- **Method**: `screencapture` + AppleScript for window detection
- **Requirements**: macOS (any recent version)
- **Features**: Application targeting, window detection, multiple capture strategies

### Linux (🚧 Planned Support)

**TODO: Implement Linux support using Wayland/X11 tools**

#### Prerequisites for Linux Implementation

**For Wayland (Recommended):**
```bash
# Install required tools
sudo apt install grim slurp  # Ubuntu/Debian
sudo pacman -S grim slurp    # Arch Linux  
sudo dnf install grim slurp  # Fedora
```

**For X11 (Legacy):**
```bash
# Install alternative tools  
sudo apt install scrot import-im6.q16  # Ubuntu/Debian
sudo pacman -S scrot imagemagick        # Arch Linux
```

#### Planned Implementation Approach

1. **Environment Detection**: Detect Wayland vs X11 session
2. **Tool Availability**: Check for `grim`/`slurp` (Wayland) or `scrot`/`import` (X11)
3. **Window Management**: 
   - Wayland: Use compositor protocols for window detection
   - X11: Use `xdotool` or `wmctrl` for window enumeration
4. **Capture Methods**:
   - Wayland: `grim -g "$(slurp)" output.png` for interactive selection
   - X11: `import -window windowid output.png` for specific windows

#### Current Limitations

- ❌ Not yet implemented
- ❌ Wayland security model requires explicit user permission for screenshots  
- ❌ Window detection varies significantly across desktop environments
- ❌ Requires additional system dependencies

**Status**: Research phase - contributions welcome!

### Windows (🚧 Planned Support)

**TODO: Implement Windows support using PowerShell/Win32 APIs**

#### Prerequisites for Windows Implementation

**PowerShell Prerequisites:**
```powershell
# Check PowerShell version (requires 5.1+ or PowerShell 7+)
$PSVersionTable.PSVersion

# Check execution policy (may need adjustment)
Get-ExecutionPolicy

# Set execution policy if needed (run as Administrator)
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Alternative: Native Win32 Tools:**
```bash
# Using Windows built-in tools
# No additional installation required for basic functionality
```

#### Planned Implementation Approaches

**Option 1: PowerShell + Windows.Graphics.Capture (Modern)**
```powershell
# Modern approach using Windows 10+ APIs
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
[Windows.Graphics.Capture.GraphicsCaptureSession]
```

**Option 2: PowerShell + Win32 APIs (Compatible)**
```powershell
# Traditional approach with broader compatibility
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::PrimaryScreen
```

**Option 3: Native Win32 Tools (Fallback)**
```batch
# Using built-in Windows tools
powershell -Command "Add-Type -AssemblyName System.Drawing..."
```

#### Implementation Challenges

**Window Detection:**
- ✅ `Get-Process` for process enumeration
- ✅ Win32 APIs for window handles and titles
- ⚠️ UAC/Admin permissions for some applications
- ⚠️ Modern apps (UWP) have different window models

**Screenshot Capture:**
- ✅ System.Drawing.Graphics.CopyFromScreen()
- ✅ Windows.Graphics.Capture for modern apps
- ⚠️ DPI awareness and scaling issues  
- ⚠️ Multiple monitor configurations

#### Current Limitations

- ❌ Not yet implemented
- ❌ PowerShell execution policy restrictions on some systems
- ❌ UAC prompts may interrupt automation
- ❌ Modern app sandboxing affects window access
- ❌ Complex multi-monitor DPI scaling scenarios
- ❌ Windows Security may block screenshot APIs

#### Feasibility Assessment

| Feature | Feasibility | Complexity | Notes |
|---------|-------------|------------|-------|
| **Basic Screenshots** | ✅ High | Low | System.Drawing APIs work reliably |
| **Window Detection** | ✅ High | Medium | Win32 APIs available via PowerShell |
| **App Targeting** | ⚠️ Medium | High | UWP apps are challenging |
| **Automation** | ⚠️ Medium | Medium | Execution policies and UAC issues |
| **Cross-Version Support** | ⚠️ Medium | High | Windows 7-11 API differences |

**Status**: Feasible but complex - PowerShell approach recommended for initial implementation.
