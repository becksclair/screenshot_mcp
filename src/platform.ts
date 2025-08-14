/**
 * Platform detection and screenshot capability utilities
 * Provides cross-platform abstractions for screenshot functionality
 */

export interface PlatformInfo {
	platform: string;
	isMac: boolean;
	isLinux: boolean;
	isWindows: boolean;
	supportsScreenshots: boolean;
	screenshotMethod: string;
	limitations: string[];
}

/**
 * Detect if current platform is macOS
 */
export const isMac = process.platform === "darwin";

/**
 * Detect if current platform is Linux
 */
export const isLinux = process.platform === "linux";

/**
 * Detect if current platform is Windows
 */
export const isWindows = process.platform === "win32";

/**
 * Determine if the current platform supports screenshot functionality
 */
export const supportsScreenshots = isMac; // Currently only macOS is fully supported

/**
 * Get detailed platform information including screenshot capabilities
 */
export function getPlatformInfo(): PlatformInfo {
	const platform = process.platform;

	if (isMac) {
		return {
			platform: "macOS",
			isMac: true,
			isLinux: false,
			isWindows: false,
			supportsScreenshots: true,
			screenshotMethod: "screencapture + AppleScript",
			limitations: []
		};
	}

	if (isLinux) {
		return {
			platform: "Linux",
			isMac: false,
			isLinux: true,
			isWindows: false,
			supportsScreenshots: false, // TODO: Implement Linux support
			screenshotMethod: "grim + slurp (planned)",
			limitations: [
				"Not yet implemented",
				"Requires Wayland compositor support",
				"grim and slurp dependencies needed",
				"X11 support requires different tooling"
			]
		};
	}

	if (isWindows) {
		return {
			platform: "Windows",
			isMac: false,
			isLinux: false,
			isWindows: true,
			supportsScreenshots: false, // TODO: Implement Windows support
			screenshotMethod: "PowerShell + Windows.Graphics.Capture (planned)",
			limitations: [
				"Not yet implemented",
				"Requires Windows 10+ for modern APIs",
				"PowerShell execution policy considerations",
				"Application permission challenges"
			]
		};
	}

	// Unknown platform
	return {
		platform: platform,
		isMac: false,
		isLinux: false,
		isWindows: false,
		supportsScreenshots: false,
		screenshotMethod: "unknown",
		limitations: ["Unsupported platform", "No screenshot implementation available"]
	};
}

/**
 * Get a human-readable error message for unsupported platforms
 */
export function getUnsupportedPlatformMessage(): string {
	const info = getPlatformInfo();

	if (info.supportsScreenshots) {
		return "Platform is supported";
	}

	const platformName = info.platform;
	const method = info.screenshotMethod;
	const mainLimitation = info.limitations[0] || "Not supported";

	return `Screenshot functionality is not available on ${platformName}. ${mainLimitation}. Planned implementation: ${method}`;
}

/**
 * Linux-specific screenshot utilities (placeholder)
 * TODO: Implement when adding Linux support
 */
export const linuxScreenshotUtils = {
	checkGrimAvailable: async (): Promise<boolean> => {
		// TODO: Check if grim is installed and available
		return false;
	},

	checkSlurpAvailable: async (): Promise<boolean> => {
		// TODO: Check if slurp is installed and available
		return false;
	},

	getWaylandSession: (): boolean => {
		// TODO: Detect if running under Wayland
		return false;
	},

	takeScreenshot: async (appName: string): Promise<string> => {
		// TODO: Implement using grim/slurp
		throw new Error("Linux screenshot support not yet implemented");
	}
};

/**
 * Windows-specific screenshot utilities (placeholder)
 * TODO: Implement when adding Windows support
 */
export const windowsScreenshotUtils = {
	checkPowerShellAvailable: async (): Promise<boolean> => {
		// TODO: Check PowerShell availability and version
		return false;
	},

	checkExecutionPolicy: async (): Promise<string> => {
		// TODO: Get current PowerShell execution policy
		return "unknown";
	},

	findWindowByTitle: async (title: string): Promise<number | null> => {
		// TODO: Find window handle by application name/title
		return null;
	},

	takeScreenshot: async (appName: string): Promise<string> => {
		// TODO: Implement using PowerShell + Windows APIs
		throw new Error("Windows screenshot support not yet implemented");
	}
};
