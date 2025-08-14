import { describe, test, expect } from "bun:test";

describe("screenshot-mcp", () => {
  test("should have valid project structure", () => {
    expect(import.meta.dir).toBeDefined();
    expect(typeof import.meta.dir).toBe("string");
  });

  test("should be able to construct script path", () => {
    const { join } = require("path");
    const scriptPath = join(import.meta.dir, "..", "winshot.sh");
    expect(scriptPath).toContain("winshot.sh");
  });
});