import fs from 'fs';
import path from 'path';

export interface AuditLogEntry {
  timestamp: string;
  type: 'router_decision' | 'tool_call' | 'tool_result' | 'policy_decision' | 'system_error';
  agent?: string;
  tool?: string;
  input?: any;
  output?: any;
  latencyMs?: number;
  message?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.json');

// Ensure the .data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize file if it doesn't exist
if (!fs.existsSync(AUDIT_FILE)) {
  fs.writeFileSync(AUDIT_FILE, JSON.stringify([], null, 2), 'utf-8');
}

/**
 * Audit Logger Service
 * Persists all agent and tool execution events into a local JSON file.
 * This file serves as the data source for the Dashboard's Audit Replay and Live Evaluation Panel.
 */
export class AuditService {
  /**
   * Append a new entry to the audit log.
   */
  static log(entry: Omit<AuditLogEntry, 'timestamp'>) {
    try {
      const currentLogs = this.readLogs();
      const newEntry: AuditLogEntry = {
        timestamp: new Date().toISOString(),
        ...entry,
      };
      
      currentLogs.push(newEntry);
      
      // Write back synchronously for now (fine for low volume local dev).
      // In production, this would go to a database or asynchronous stream.
      fs.writeFileSync(AUDIT_FILE, JSON.stringify(currentLogs, null, 2), 'utf-8');
    } catch (err) {
      console.error('[AuditService] Failed to write audit log:', err);
    }
  }

  /**
   * Read all logs.
   */
  static readLogs(): AuditLogEntry[] {
    try {
      if (!fs.existsSync(AUDIT_FILE)) return [];
      const content = fs.readFileSync(AUDIT_FILE, 'utf-8');
      return JSON.parse(content) as AuditLogEntry[];
    } catch (err) {
      console.error('[AuditService] Failed to read audit log:', err);
      return [];
    }
  }

  /**
   * Get metrics for the Live Evaluation Panel.
   */
  static getMetrics() {
    const logs = this.readLogs();
    const toolCalls = logs.filter(l => l.type === 'tool_result');
    const successes = toolCalls.filter(l => !l.output?.error);
    const errors = toolCalls.filter(l => l.output?.error);
    
    let totalLatency = 0;
    let latencyCount = 0;
    
    toolCalls.forEach(l => {
      if (typeof l.latencyMs === 'number') {
        totalLatency += l.latencyMs;
        latencyCount++;
      }
    });

    return {
      totalTasks: toolCalls.length,
      successRate: toolCalls.length > 0 ? (successes.length / toolCalls.length) * 100 : 0,
      averageLatencyMs: latencyCount > 0 ? totalLatency / latencyCount : 0,
      errorCount: errors.length,
    };
  }
}
