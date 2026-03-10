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