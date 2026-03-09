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

// Check for --http-only flag
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
  // HTTP server only mode - run start.ts directly
  // Import and run the HTTP server
  import("../start.js").catch(console.error);
} else {
  // Start MCP Server (which also starts HTTP server)
  main().catch(console.error);
}

async function main() {
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const { createMcpServer } = await import("./server.js");
  const { selectStorageBackend, getLegacyStorageRootForBackend } = await import("../../ingest/storage-backend.js");
  const { Hono } = await import("hono");
  const { createApi } = await import("../api.js");
  const { createDashboardStore, type DashboardStore } = await import("../dashboard.js");
  const { addOrUpdateSource, listSources } = await import("../../ingest/sources-registry.js");
  const { findAvailablePort } = await import("../../cli/ports.js");

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

  // Start HTTP server in the same process (not spawning a new process)
  console.error("[MCP] Starting HTTP dashboard server...");
  
  const preferredPort = 51234;
  const host = '127.0.0.1';
  
  let port: number;
  try {
    port = await findAvailablePort({ host, preferredPort });
    if (port !== preferredPort) {
      console.error(`[MCP] Port ${preferredPort} is busy; using ${port} instead`);
    }
  } catch (err) {
    console.error(`[MCP] Failed to find an available port starting from ${preferredPort}`);
    console.error("[MCP] HTTP server will not be started");
    port = 0; // Skip HTTP server
  }

  let serverUrl: string | null = null;

  if (port > 0) {
    const app = new Hono();

    if (storageBackend.kind === "sqlite" && listSources(storageRoot).length === 0) {
      console.error("[MCP] No sources found. Run: bunx oh-my-opencode-dashboard add --name 'My Project'");
    }

    const store = createDashboardStore({
      projectRoot,
      storageRoot,
      storageBackend,
      watch: true,
      pollIntervalMs: 2000,
    });

    const storeBySourceId = new Map<string, DashboardStore>();
    const storeByProjectRoot = new Map<string, DashboardStore>([[projectRoot, store]]);

    const getStoreForSource = ({ sourceId, projectRoot }: { sourceId: string; projectRoot: string }) => {
      const existing = storeBySourceId.get(sourceId);
      if (existing) return existing;

      const byRoot = storeByProjectRoot.get(projectRoot);
      if (byRoot) {
        storeBySourceId.set(sourceId, byRoot);
        return byRoot;
      }

      const created = createDashboardStore({
        projectRoot,
        storageRoot,
        storageBackend,
        watch: true,
        pollIntervalMs: 2000,
      });
      storeBySourceId.set(sourceId, created);
      storeByProjectRoot.set(projectRoot, created);
      return created;
    };

    app.route('/api', createApi({ store, storageRoot, projectRoot, storageBackend, getStoreForSource }));

    // Determine dist root
    let distRoot: string;
    const scriptDir = __dirname;
    const localDist = join(scriptDir, '..', '..', '..', 'dist');
    const projectDist = join(projectRoot, 'dist');
    
    if (fs.existsSync(join(localDist, 'index.html'))) {
      distRoot = localDist;
    } else if (fs.existsSync(join(projectDist, 'index.html'))) {
      distRoot = projectDist;
    } else {
      distRoot = localDist;
      console.error(`[MCP] Warning: dist folder not found at ${distRoot}`);
    }

    // SPA fallback middleware
    app.use('*', async (c, next) => {
      const path = c.req.path;
      
      if (path.startsWith('/api/')) {
        return await next();
      }
      
      if (!path.includes('.')) {
        const indexFile = Bun.file(join(distRoot, 'index.html'));
        if (await indexFile.exists()) {
          return c.html(await indexFile.text());
        }
        return c.notFound();
      }
      
      const relativePath = path.startsWith('/') ? path.slice(1) : path;
      const file = Bun.file(join(distRoot, relativePath));
      if (await file.exists()) {
        const ext = path.split('.').pop() || '';
        const contentType = getContentType(ext);
        return new Response(file, {
          headers: { 'Content-Type': contentType }
        });
      }
      
      return c.notFound();
    });

    function getContentType(ext: string): string {
      const types: Record<string, string> = {
        'html': 'text/html',
        'js': 'application/javascript',
        'css': 'text/css',
        'json': 'application/json',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
      };
      return types[ext] || 'text/plain';
    }

    const server = Bun.serve({
      fetch: app.fetch,
      hostname: host,
      port,
    });

    serverUrl = `http://${host}:${port}`;
    console.error(`[MCP] Dashboard available at: ${serverUrl}`);

    // Open browser
    setTimeout(() => {
      if (serverUrl) {
        console.error(`[MCP] Opening browser...`);
        const platform = process.platform;
        
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
