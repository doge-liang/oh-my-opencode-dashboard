#!/usr/bin/env bun
/**
 * MCP Server CLI Entry Point
 * 
 * Usage:
 *   bun run mcp -- --project /path/to/project
 *   bun run src/server/mcp/index.ts -- --project /path/to/project
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./server.js";
import { selectStorageBackend, getLegacyStorageRootForBackend } from "../../ingest/storage-backend.js";
import { spawn } from "child_process";

// Parse command line arguments
const args = Bun.argv;
const projectIndex = args.indexOf("--project");

let projectRoot: string;
if (projectIndex !== -1 && args[projectIndex + 1]) {
  projectRoot = args[projectIndex + 1];
} else {
  projectRoot = process.cwd();
}

const storageBackend = selectStorageBackend();
const storageRoot = getLegacyStorageRootForBackend(storageBackend);

// Start HTTP server in the background
console.error("[MCP] Starting HTTP dashboard server...");
const httpProcess = spawn("bun", ["run", "src/server/start.ts", "--project", projectRoot], {
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});

let serverUrl: string | null = null;

// Capture server URL from output
httpProcess.stdout?.on("data", (data: Buffer) => {
  const output = data.toString();
  const match = output.match(/Server running on (http:\/\/[^\s]+)/);
  if (match) {
    serverUrl = match[1];
    console.error(`[MCP] Dashboard available at: ${serverUrl}`);
    
    // Open browser
    setTimeout(() => {
      if (serverUrl) {
        const platform = process.platform;
        console.error(`[MCP] Opening browser...`);
        
        if (platform === "win32") {
          spawn("cmd", ["/c", "start", serverUrl], { detached: true, stdio: "ignore" });
        } else if (platform === "darwin") {
          spawn("open", [serverUrl], { detached: true, stdio: "ignore" });
        } else {
          spawn("xdg-open", [serverUrl], { detached: true, stdio: "ignore" });
        }
      }
    }, 1000);
  }
});

httpProcess.stderr?.on("data", (data: Buffer) => {
  // Forward HTTP server errors to stderr
  console.error(`[HTTP] ${data.toString().trim()}`);
});

// Create MCP Server
const server = createMcpServer({
  projectRoot,
  storageRoot,
  storageBackend,
});

// Create stdio transport
const transport = new StdioServerTransport();

// Connect and run
// Note: All logging must go to stderr to avoid polluting stdio protocol
console.error(`[MCP] Starting MCP server for project: ${projectRoot}`);
console.error(`[MCP] Storage root: ${storageRoot}`);
console.error(`[MCP] Storage backend: ${storageBackend.kind}`);

await server.connect(transport);

console.error("[MCP] Server connected and ready");
