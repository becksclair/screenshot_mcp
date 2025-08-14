#!/usr/bin/env bun

// Pure TypeScript implementation of macOS screenshot logic (formerly a shell script).
// Provides both a programmatic API (screenshotApp) and a CLI (when run directly)
// retaining the original stdout style for compatibility.

import { existsSync, readFileSync, statSync } from "node:fs";

export interface AppScreenshotOptions {
	compress?: boolean; // Apply PNG compression via sips
	strategy?: "auto" | "id" | "bounds" | "interactive"; // Window capture strategy
	returnData?: boolean; // Return base64 data instead of path (<=1MB)
	timeoutMs?: number; // Overall timeout (default 15000)
}

export interface AppScreenshotResult {
	success: boolean;
	path?: string; // Absolute file path of screenshot
	dataUri?: string; // Base64 data URI when returnData requested
	method?: string; // Capture method actually used
	stdout: string[]; // Lines emitted (mirrors CLI output)
	error?: string; // Error message if success=false
	tooLargeForData?: boolean; // Indicates file exceeded base64 size threshold
}

interface RunResult {
	stdout: string;
	stderr: string;
	code: number;
}

function nowTimestamp(): string {
	// Matches script format: YYYYMMDD_HHMMSS
	const d = new Date();
	const p = (n: number, l = 2) => n.toString().padStart(l, "0");
	return (
		`${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_` +
		`${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
	);
}

async function run(
	cmd: string[],
	opts: { env?: Record<string, string | undefined>; timeoutMs?: number } = {}
): Promise<RunResult> {
	const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe", stdin: "ignore", env: opts.env });
	const timeout = opts.timeoutMs ?? 10000;
	const timeoutPromise = new Promise<never>((_, reject) => {
		setTimeout(() => {
			proc.kill();
			reject(new Error("[TIMEOUT]"));
		}, timeout);
	});
	try {
		const [stdout, stderr, code] = await Promise.race([
			Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]),
			timeoutPromise
		]);
		return { stdout, stderr, code };
	} catch (e) {
		if (e instanceof Error && e.message === "[TIMEOUT]") {
			return { stdout: "", stderr: "[TIMEOUT]", code: 124 };
		}
		return { stdout: "", stderr: String(e), code: 1 };
	}
}

async function runAppleScript(script: string, timeoutMs = 8000): Promise<RunResult> {
	return run(["osascript", "-e", script], { timeoutMs });
}

async function listForegroundApps(): Promise<string[]> {
	const script = 'tell application "System Events" to get name of every process whose background only is false';
	const res = await runAppleScript(script, 6000);
	if (res.code !== 0) return [];
	return res.stdout
		.split(",")
		.map(s => s.trim())
		.filter(Boolean);
}

async function resolveActualAppName(input: string): Promise<string | null> {
	// First attempt: case-insensitive contains either direction
	const esc = (s: string) => s.replace(/"/g, '\\"');
	const script1 = `try\n  tell application "System Events"\n    set allProcesses to name of every process whose background only is false\n    repeat with processName in allProcesses\n      if (processName as string) contains "${esc(input)}" or ("${esc(input)}" as string) contains (processName as string) then\n        return processName as string\n      end if\n    end repeat\n    repeat with processName in allProcesses\n      if (processName as string) is equal to "${esc(input)}" then\n        return processName as string\n      end if\n    end repeat\n    return "NOT_FOUND"\n  end tell\nend try`;
	let res = await runAppleScript(script1, 7000);
	if (res.code === 0 && res.stdout.trim() && res.stdout.trim() !== "NOT_FOUND") return res.stdout.trim();

	// Second attempt: lowercased partial
	const script2 = `try\n  tell application "System Events"\n    set allProcesses to name of every process whose background only is false\n    repeat with processName in allProcesses\n      set lowerProcessName to do shell script "echo " & quoted form of (processName as string) & " | tr '[:upper:]' '[:lower:]'"\n      set lowerSearchName to do shell script "echo " & quoted form of "${esc(input)}" & " | tr '[:upper:]' '[:lower:]'"\n      if lowerProcessName contains lowerSearchName or lowerSearchName contains lowerProcessName then\n        return processName as string\n      end if\n    end repeat\n    return "NOT_FOUND"\n  end tell\nend try`;
	res = await runAppleScript(script2, 7000);
	if (res.code === 0 && res.stdout.trim() && res.stdout.trim() !== "NOT_FOUND") return res.stdout.trim();
	return null;
}

async function getWindowInfo(actualAppName: string): Promise<string> {
	const script = `try\n  tell application "System Events"\n    set appProcess to first process whose name is "${actualAppName.replace(/"/g, '\\"')}"\n    set windowCount to count of windows of appProcess\n    if windowCount > 0 then\n      set frontWindow to first window of appProcess\n      try\n        set windowID to id of frontWindow\n        return "WINDOW_ID:" & windowID\n      on error\n        set windowBounds to position of frontWindow & size of frontWindow\n        return "BOUNDS:" & (item 1 of windowBounds) & "," & (item 2 of windowBounds) & "," & (item 3 of windowBounds) & "," & (item 4 of windowBounds)\n      end try\n    else\n      return "NO_WINDOWS"\n    end if\n  end tell\nend try`;
	const res = await runAppleScript(script, 6000);
	if (res.code === 0 && res.stdout.trim()) return res.stdout.trim();
	return "ERROR";
}

async function bringToFront(actualAppName: string): Promise<void> {
	const script = `tell application "System Events" to set frontmost of first process whose name is "${actualAppName.replace(/"/g, '\\"')}" to true`;
	await runAppleScript(script, 4000);
	// small delay (~1s) replicating script's 'delay 1'
	await new Promise(r => setTimeout(r, 1000));
}

async function ensureScreenshotDir(): Promise<string> {
	const dir = `${process.env.HOME}/Desktop/Screenshots`;
	await run(["mkdir", "-p", dir]);
	return dir;
}

function buildFilename(dir: string, actualAppName: string): string {
	const safeName = actualAppName.replace(/\s+/g, "_");
	return `${dir}/screenshot_${safeName}_${nowTimestamp()}.png`;
}

async function compressPng(path: string): Promise<void> {
	// Mirror original temporary compression
	const tmp = `${path.slice(0, -4)}_temp.png`;
	const res = await run(
		["sips", "-s", "format", "png", "--setProperty", "formatOptions", "default", path, "--out", tmp],
		{ timeoutMs: 8000 }
	);
	if (res.code === 0 && existsSync(tmp)) {
		await run(["mv", tmp, path]);
	}
}

async function captureWithStrategy(
	strategy: string,
	windowInfo: string,
	filename: string,
	lines: string[]
): Promise<{ code: number; method: string; stderr: string; stdout: string }> {
	let args: string[] = [];
	let method = "frontmost";
	if (strategy === "id") {
		if (windowInfo.startsWith("WINDOW_ID:")) {
			const id = windowInfo.slice("WINDOW_ID:".length);
			lines.push(`✅ Using window ID method (ID: ${id})`);
			args = ["screencapture", "-l", id, "-o", filename];
			method = "window-id";
		} else {
			lines.push("⚠️  Window ID not available, falling back to frontmost window");
			args = ["screencapture", "-w", "-o", filename];
		}
	} else if (strategy === "bounds") {
		if (windowInfo.startsWith("BOUNDS:")) {
			const bounds = windowInfo.slice("BOUNDS:".length);
			lines.push(`✅ Using bounds method (${bounds})`);
			args = ["screencapture", "-R", bounds, "-o", filename];
			method = "bounds";
		} else {
			lines.push("⚠️  Window bounds not available, falling back to frontmost window");
			args = ["screencapture", "-w", "-o", filename];
		}
	} else if (strategy === "interactive") {
		lines.push("🖱️  Starting interactive selection...");
		lines.push("💡 Click on the app window or area you want to capture when the crosshair appears");
		args = ["screencapture", "-i", "-o", filename];
		method = "interactive";
	} else {
		// auto
		if (windowInfo.startsWith("WINDOW_ID:")) {
			const id = windowInfo.slice("WINDOW_ID:".length);
			lines.push(`✅ Using window ID method (ID: ${id})`);
			args = ["screencapture", "-l", id, "-o", filename];
			method = "window-id";
		} else if (windowInfo.startsWith("BOUNDS:")) {
			const bounds = windowInfo.slice("BOUNDS:".length);
			lines.push(`✅ Using bounds method (${bounds})`);
			args = ["screencapture", "-R", bounds, "-o", filename];
			method = "bounds";
		} else if (windowInfo === "NO_WINDOWS") {
			lines.push("⚠️  App has no windows. Starting interactive selection...");
			lines.push("💡 Click on the app window or area you want to capture when the crosshair appears");
			args = ["screencapture", "-i", "-o", filename];
			method = "interactive";
		} else {
			lines.push("⚠️  Falling back to frontmost window capture");
			args = ["screencapture", "-w", "-o", filename];
		}
	}
	const res = await run(args, { timeoutMs: 12000 });
	return { code: res.code, method, stderr: res.stderr, stdout: res.stdout };
}

export async function screenshotApp(appName: string, opts: AppScreenshotOptions = {}): Promise<AppScreenshotResult> {
	const lines: string[] = [];
	const strategy = opts.strategy || process.env.WINDOW_STRATEGY || "auto";
	// overall timeoutMs currently unused (placeholder for future aggregated time budget)

	if (!appName) {
		const usage = `❌ Error: No app name provided\nUsage: screenshotApp("App Name")`;
		lines.push(usage);
		return { success: false, stdout: lines, error: "No app name" };
	}

	lines.push(`🔍 Looking for app: ${appName}`);
	const actualApp = await resolveActualAppName(appName);
	if (!actualApp) {
		lines.push(`❌ Could not find app '${appName}'`);
		lines.push("💡 Make sure the app is running and try one of these:");
		lines.push("");
		const running = await listForegroundApps();
		if (running.length) {
			lines.push("Available running apps:");
			running.forEach(n => lines.push(`• ${n}`));
		}
		return { success: false, stdout: lines, error: "App not found" };
	}

	lines.push(`✅ Found app: ${actualApp}`);
	const windowInfo = await getWindowInfo(actualApp);
	lines.push(`🔍 Window info: ${windowInfo}`);

	await bringToFront(actualApp);
	lines.push("📸 Taking screenshot...");
	lines.push(`🎯 Using window strategy: ${strategy}`);

	const dir = await ensureScreenshotDir();
	const filename = buildFilename(dir, actualApp);

	const capture = await captureWithStrategy(strategy, windowInfo, filename, lines);
	if (capture.code !== 0 || !existsSync(filename)) {
		lines.push("❌ Failed to capture screenshot");
		return { success: false, stdout: lines, error: capture.stderr || capture.stdout || "Capture failed" };
	}

	lines.push(`📸 Screenshot saved: ${filename}`);

	if (opts.compress || process.env.COMPRESS === "1") {
		lines.push("🗜️  Compressing PNG file...");
		try {
			const original = statSync(filename).size;
			await compressPng(filename);
			const after = statSync(filename).size;
			if (after <= original) {
				const savings = original - after;
				const pct = original ? Math.round((savings * 100) / original) : 0;
				lines.push(
					`✅ Compression complete: ${original} bytes → ${after} bytes (saved ${savings} bytes, ${pct}%)`
				);
			} else {
				lines.push("⚠️  Compression did not reduce size");
			}
		} catch {
			lines.push("⚠️  Compression failed, using original file");
		}
	}

	lines.push("🎉 Done!");

	// Base64 encoding if requested
	if (opts.returnData) {
		try {
			const stats = statSync(filename);
			const max = 1024 * 1024; // 1MB
			if (stats.size > max) {
				lines.push(`File too large for base64 encoding (${Math.round(stats.size / 1024)} KB > 1024 KB limit)`);
				return { success: true, path: filename, stdout: lines, method: capture.method, tooLargeForData: true };
			}
			const buf = readFileSync(filename);
			const dataUri = `data:image/png;base64,${buf.toString("base64")}`;
			return { success: true, path: filename, dataUri, stdout: lines, method: capture.method };
		} catch (e) {
			lines.push(`Failed to base64 encode: ${e instanceof Error ? e.message : String(e)}`);
			return { success: true, path: filename, stdout: lines, method: capture.method };
		}
	}

	return { success: true, path: filename, stdout: lines, method: capture.method };
}

// CLI entrypoint replicating original script behavior
async function mainCli(): Promise<number> {
	const [, , ...args] = process.argv;
	const appName = args[0];
	const result = await screenshotApp(appName || "");
	for (const line of result.stdout) console.log(line);
	if (!result.success) return 1;
	return 0;
}

if (import.meta.main) {
	mainCli().then(code => process.exit(code));
}

export default screenshotApp;
