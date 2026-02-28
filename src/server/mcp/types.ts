/**
 * Shared types for MCP Server
 */

import type { StorageBackend } from "../../ingest/storage-backend.js";

export interface McpServerOptions {
  projectRoot: string;
  storageRoot: string;
  storageBackend: StorageBackend;
}
