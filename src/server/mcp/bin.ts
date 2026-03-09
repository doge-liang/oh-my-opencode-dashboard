#!/usr/bin/env bun
/**
 * MCP Server Bin Entry Point
 * 
 * Usage:
 *   oh-my-opencode-dashboard                          # Start MCP with current directory
 *   oh-my-opencode-dashboard --project /path          # Start MCP with specified directory
 *   oh-my-opencode-dashboard cli:sessions             # List active sessions
 *   oh-my-opencode-dashboard --http-only --project /path  # Start HTTP server only (no MCP)
 */

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);

// Check for --http-only flag (internal use for spawning HTTP server)
const httpOnly = args.includes("--http-only");
const filteredArgs = args.filter(arg => arg !== "--http-only");

// Check for subcommands
if (filteredArgs[0] === "cli:sessions") {
  // Run sessions CLI
  const sessionsScript = join(__dirname, "..", "..", "cli", "sessions.ts");
  const result = spawn("bun", ["run", sessionsScript], {
    stdio: "inherit",
    windowsHide: false,
  });
  
  result.on("exit", (code) => {
    process.exit(code || 0);
  });
} else if (httpOnly) {
  // HTTP server only mode (spawned by MCP server)
  // Import and run start.ts directly by executing it
  const startScript = join(__dirname, "..", "start.ts");
  
  if (fs.existsSync(startScript)) {
    // Spawn start.ts as a separate process
    const httpProcess = spawn("bun", ["run", startScript, ...filteredArgs], {
      stdio: "inherit",
      windowsHide: false,
    });
    
    httpProcess.on("exit", (code) => {
      process.exit(code || 0);
    });
  } else {
    console.error(`[HTTP] Error: Cannot find start.ts at ${startScript}`);
    process.exit(1);
  }
} else {
  // Start MCP Server
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { createMcpServer } = await import("./server.js");
  const { selectStorageBackend, getLegacyStorageRootForBackend } = await import("../../ingest/storage-backend.js");

  // Parse --project argument
  const projectIndex = filteredArgs.indexOf("--project");
  let projectRoot: string;
  if (projectIndex !== -1 && filteredArgs[projectIndex + 1]) {
    projectRoot = filteredArgs[projectIndex + 1];
  } else {
    projectRoot = process.cwd();
  }

  const storageBackend = selectStorageBackend();
  const storageRoot = getLegacyStorageRootForBackend(storageBackend);

  // Start HTTP server in the background by spawning ourselves with --http-only flag
  const startScript = join(__dirname, "..", "start.ts");
  
  if (fs.existsSync(startScript)) {
    console.error("[MCP] Starting HTTP dashboard server...");
    const httpProcess = spawn(process.execPath, [
      ...process.execArgv,
      __filename,
      "--http-only",
      ...filteredArgs
    ], {
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
      console.error(`[HTTP] ${data.toString().trim()}`);
    });
  } else {
    console.error("[MCP] Warning: Cannot find start.ts, HTTP server will not be started");
  }

  // Create MCP Server
  const server = createMcpServer({
    projectRoot,
    storageRoot,
    storageBackend,
  });

  // Create stdio transport
  const transport = new StdioServerTransport();

  // Connect and run
  console.error(`[MCP] Starting MCP server for project: ${projectRoot}`);
  console.error(`[MCP] Storage root: ${storageRoot}`);
  console.error(`[MCP] Storage backend: ${storageBackend.kind}`);

  await server.connect(transport);

  console.error("[MCP] Server connected and ready");
}
