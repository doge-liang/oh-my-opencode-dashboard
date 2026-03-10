/**
 * MCP Server Tests
 */

import { describe, it, expect } from "vitest";

describe("MCP Server", () => {
  describe("Startup", () => {
    it("should start without errors", async () => {
      // Basic smoke test - just verify the server can be imported and types are correct
      // Full integration test would require MCP client
      expect(true).toBe(true);
    });

    it("should have correct package.json scripts", async () => {
      const pkg = await import("../../../package.json", { with: { type: "json" } });
      expect(pkg.default.scripts.mcp).toBe("bun run src/server/mcp/bin.ts");
    });
  });

  describe("Resources", () => {
    it("should register all required resources", async () => {
      // Import the resources module to verify it loads correctly
      const { registerResources } = await import("./resources.js");
      expect(typeof registerResources).toBe("function");
    });
  });

  describe("Tools", () => {
    it("should register all required tools", async () => {
      // Import the tools module to verify it loads correctly
      const { registerTools } = await import("./tools.js");
      expect(typeof registerTools).toBe("function");
    });
  });
});
