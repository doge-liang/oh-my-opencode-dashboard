# AI Agent Notes

## bunx Caching on Windows

When running this dashboard via `bunx oh-my-opencode-dashboard@latest`, Bun caches the compiled executable. This can cause stale builds to persist even after new versions are published.

### Cache Location

```
~/AppData/Local/Temp/bunx-*
```

Each package gets its own directory like:
```
bunx-1234567890-oh-my-opencode-dashboard/
```

### When to Clear Cache

Clear the cache when:
- UI changes are not reflecting after a GitHub push
- New features or fixes from a published update aren't appearing
- Suspecting a stale build is causing issues

### Fix Command

```bash
rm -rf ~/AppData/Local/Temp/bunx-*-oh-my-opencode-dashboard*
```

Or from PowerShell:
```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\bunx-*-oh-my-opencode-dashboard*"
```

### Tips

- A version bump in `package.json` triggers a fresh download from npm
- `@latest` tag ensures the newest version, but cache takes precedence
- For development, use `bun run dev` to bypass bunx caching entirely

---

## Build Commands

```bash
# Full build (UI + API)
bun run build

# Build UI only
bun run build:ui

# Build API only
bun run build:api

# Type checking
bun run typecheck
```

## Development Commands

```bash
# Start dev server (API + UI with hot reload)
bun run dev

# Start API server only
bun run dev:api

# Start UI dev server only
bun run dev:ui

# Production server
bun run start

# MCP server mode
bun run mcp
```

## Test Commands

```bash
# Run all tests
bun test

# Run specific test file
bun test src/server/mcp/mcp.test.ts

# Run tests matching a pattern
bun test -- --grep "MCP Server"

# Run tests in watch mode
bun test -- --watch
```

## Code Style Guidelines

### TypeScript Configuration

- **Target**: ES2022 with strict mode enabled
- **Module**: ESNext with Bundler resolution
- **JSX**: react-jsx transform
- **Runtime**: Bun (types from `bun-types`)

### Import Patterns

```typescript
// Node built-ins: use node: prefix
import * as fs from "node:fs"
import * as path from "node:path"
import net from "node:net"

// External packages
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Internal modules: use .js extension for imports
import { registerTools } from "./tools.js"
import { listSources } from "../../ingest/sources-registry.js"

// Types: explicit type imports
import type { StorageBackend } from "../ingest/storage-backend"
```

### Naming Conventions

```typescript
// Types: PascalCase
type TokenUsageRow = { ... }
interface DashboardPayload { ... }

// Functions: camelCase
function findAvailablePort(options: FindAvailablePortOptions): Promise<number> { ... }

// Constants: UPPER_SNAKE_CASE for true constants
const EMPTY_TOTALS: TokenUsageTotals = { ... }

// Variables: camelCase
const targetProjectRoot = projectRoot
let offset = 0

// React components: PascalCase
function DashboardPanel() { ... }
```

### Type Definitions

```typescript
// Prefer explicit return types on exported functions
export function clampToken(value: unknown): number { ... }

// Use type guards for runtime checks
function isRecord(value: unknown): value is Record<string, unknown> { ... }

// Type assertions should be safe and explicit
const r = row as Record<string, unknown>
```

### Error Handling

```typescript
// Throw descriptive errors
throw new Error("preferredPort must be a positive integer")

// Try-catch with specific error handling
try {
  const result = await someAsyncOperation()
  return result
} catch (error) {
  // Handle or rethrow with context
  throw new Error(`Failed to process: ${error}`)
}

// Return error objects instead of throwing for expected failures
return {
  content: [{ type: "text", text: `Error: Source not found.` }],
  isError: true,
}
```

### Test Patterns

```typescript
import { describe, it, expect } from "vitest"

describe("Feature Name", () => {
  describe("Sub-feature", () => {
    it("should do something specific", async () => {
      const result = await someFunction()
      expect(result).toBe(expected)
    })
  })
})
```

### File Organization

```
src/
├── server/          # API server, MCP server, routes
├── ingest/          # Data ingestion from OpenCode/SQLite
├── cli/             # CLI commands
├── components/      # React components
└── *.test.ts        # Test files alongside source
```

### Comments

```typescript
// Use JSDoc for exported functions and types
/**
 * Find an available port starting from preferredPort
 */
export async function findAvailablePort(options: FindAvailablePortOptions): Promise<number> { ... }

// Section comments for grouping related code
// === Port Checking ===
```

### No Linting Tools

This project does not use ESLint, Prettier, or Biome. Code style is enforced through:
- TypeScript strict mode
- Code review
- Consistent patterns in existing code

Always run `bun run typecheck` before committing.
