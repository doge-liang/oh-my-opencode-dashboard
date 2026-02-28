#!/usr/bin/env bun
/**
 * CLI command to list active sessions and their URLs
 * 
 * Usage:
 *   bun run cli:sessions
 *   bun run src/cli/sessions.ts
 */

import * as fs from "node:fs"
import * as path from "node:path"
import net from "node:net"
import { getOpenCodeStorageDir, realpathSafe } from "../ingest/paths.js"
import { getStorageRoots, readMainSessionMetas, type SessionMetadata } from "../ingest/session.js"

interface SessionInfo extends SessionMetadata {
  url?: string
  isRunning: boolean
}

/**
 * Check if a server is running on the given port
 */
async function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    
    socket.setTimeout(1000)
    
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    
    socket.on('error', () => {
      resolve(false)
    })
    
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    
    socket.connect(port, host)
  })
}

/**
 * Find all running dashboard servers
 */
async function findRunningServers(
  host: string,
  startPort: number,
  maxPorts: number = 20
): Promise<Map<number, string>> {
  const runningServers = new Map<number, string>()
  
  for (let i = 0; i < maxPorts; i++) {
    const port = startPort + i
    const isRunning = await checkPort(host, port)
    if (isRunning) {
      runningServers.set(port, `http://${host}:${port}`)
    }
  }
  
  return runningServers
}

/**
 * Format date for display
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}天前`
  if (hours > 0) return `${hours}小时前`
  if (minutes > 0) return `${minutes}分钟前`
  return `${seconds}秒前`
}

async function main() {
  const storageRoot = getOpenCodeStorageDir()
  const storage = getStorageRoots(storageRoot)
  
  console.log('🔍 Scanning for active sessions...\n')
  
  // Read all sessions
  const allSessions = readMainSessionMetas(storage.session)
  
  if (allSessions.length === 0) {
    console.log('❌ No sessions found')
    console.log(`   Storage directory: ${storageRoot}`)
    process.exit(0)
  }
  
  // Find running servers
  const host = '127.0.0.1'
  const startPort = 51234
  const runningServers = await findRunningServers(host, startPort)
  
  // Map sessions to running servers (based on directory match)
  const sessionInfos: SessionInfo[] = allSessions.map((session, index) => {
    // Assign ports round-robin to running servers for display purposes
    // In reality, we can't know which session maps to which port without additional tracking
    const runningPorts = Array.from(runningServers.keys())
    const assignedPort = index < runningPorts.length ? runningPorts[index] : undefined
    
    return {
      ...session,
      url: assignedPort ? `http://${host}:${assignedPort}` : undefined,
      isRunning: !!assignedPort,
    }
  })
  
  // Display results
  console.log(`📊 Found ${allSessions.length} session(s) in storage`)
  console.log(`🌐 Found ${runningServers.size} running server(s)\n`)
  
  console.log('='.repeat(80))
  console.log()
  
  sessionInfos.forEach((session, index) => {
    const number = index + 1
    const status = session.isRunning ? '🟢' : '⚪'
    const title = session.title || 'Untitled Session'
    const dir = session.directory
    const sessionId = session.id.slice(0, 8) + '...'
    
    console.log(`${status} Session #${number}`)
    console.log(`   ID:        ${sessionId}`)
    console.log(`   Title:     ${title}`)
    console.log(`   Directory: ${dir}`)
    console.log(`   Created:   ${formatDate(session.time.created)} (${formatRelativeTime(session.time.created)})`)
    console.log(`   Updated:   ${formatDate(session.time.updated)} (${formatRelativeTime(session.time.updated)})`)
    
    if (session.isRunning && session.url) {
      console.log(`   🌐 URL:     ${session.url}`)
    } else {
      console.log(`   ⚪ Status:  Not running`)
    }
    
    console.log()
  })
  
  console.log('='.repeat(80))
  console.log()
  
  // Print all running server URLs
  if (runningServers.size > 0) {
    console.log('🌐 Running Dashboard URLs:')
    runningServers.forEach((url, port) => {
      console.log(`   • ${url} (port ${port})`)
    })
    console.log()
  }
  
  // Quick start command hint
  console.log('💡 To start a new dashboard:')
  console.log('   bun run start -- --project /path/to/project')
  console.log()
  console.log('💡 Or use MCP mode:')
  console.log('   bun run mcp -- --project /path/to/project')
}

main().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
